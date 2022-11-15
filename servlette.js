module.exports = function (configured) {
  const http = require("http");
  const https = require("https");
  const decodeQueryString = require("querystring").decode;
  const cookieParser = require("cookie");
  const { resolve, normalize, sep } = require("path");
  const { readFileSync, statSync } = require("fs");
  const jalosi = require("jalosi");

  const slash = "/";
  var server = null;
  var cache = {};
  var htmlExtensions = undefined;
  var scriptsExtensions = undefined;

  const char = (text, index) => text.charCodeAt(index | 0);
  const json = JSON.stringify;
  const removeTrailingSlash = (text) =>
    text.endsWith(slash) || text.endsWith(sep)
      ? text.substr(0, text.length - 1)
      : text;

  function getCachedFile(fileName, encoding) {
    if (encoding === false) encoding = { raw: true };
    else if (encoding === true) encoding = { raw: false };
    else encoding = encoding || {};
    let info = statSync(fileName);
    let cached = cache[fileName];
    if (!cached) cached = cache[fileName] = {};
    let stamp = info.mtimeMs;
    if (stamp != cached.stamp) {
      cached.contents = readFileSync(
        fileName,
        encoding.utf || !encoding.raw ? "utf-8" : null
      );
      cached.stamp = stamp;
    }
    return cached.contents;
  }

  function stop() {
    if (server) {
      server.close();
      server = null;
    }
  }

  function findReplaceAll(text, pattern, replacement) {
    while (text.indexOf(pattern) >= 0)
      text = text.replace(pattern, replacement);
    return text;
  }

  function fileExists(fileName) {
    try {
      return statSync(fileName).isFile();
    } catch (ignored) {
      return false;
    }
  }

  function lookup(directoryPaths, route, extensions) {
    if (!directoryPaths) return null;
    let verbose = configured.verbose;
    for (let ddx in directoryPaths) {
      let fullPath = directoryPaths[ddx] + route;
      for (let edx in extensions) {
        let guess = normalize(fullPath + extensions[edx]);
        if (sep != slash) guess = findReplaceAll(guess, slash, sep);
        verbose("looking up:", guess);
        if (fileExists(guess)) {
          verbose("...found");
          return guess;
        }
      }
    }
    return null;
  }

  function sanitizeRoute(text) {
    let result = removeTrailingSlash(normalize(text));
    result = findReplaceAll(result, "..", "");
    if (result.startsWith(".")) result = result.substr(1);
    if (!result.startsWith(slash)) result = slash + result;
    return result;
  }

  function dispatchRoute(servlette, route, scriptDirs, rootDirs) {
    if (typeof route === "function")
      return route(servlette, servlette.request, servlette.response);
    let router = configured.routes;
    let sub = route;
    if (sub.startsWith("/")) sub = sub.substr(1);
    if (router.hasOwnProperty(sub)) {
      let handler = router[sub];
      let type = typeof handler;
      if (type === "function")
        return handler(servlette, servlette.request, servlette.response);
      else if (type === "object") {
        let method = servlette.method.toLowerCase();
        if (handler.hasOwnProperty(method)) {
          return dispatchRoute(
            servlette,
            handler[method],
            scriptDirs,
            rootDirs
          );
        } else return false;
      } else route = normalize(slash + handler);
    }

    let candidateRouteNames = rootDirs
      ? [route, route + slash + "index"]
      : [route];
    for (let edx in candidateRouteNames) {
      let extended = candidateRouteNames[edx];

      let pathToFile = lookup(rootDirs, extended, htmlExtensions);
      if (pathToFile) {
        servlette.raw(getCachedFile(pathToFile, false));
        return true;
      }

      let pathToScript = lookup(scriptDirs, extended, scriptsExtensions);
      if (pathToScript) return jalosi.load(pathToScript, servlette);
    }
    return false;
  }

  function handleRoute(servlette, route, scriptDirs, rootDirs) {
    let result = dispatchRoute(servlette, route, scriptDirs, rootDirs);
    let type = typeof result;
    if (result === true || result === false) return result;
    if (result === null) return false;
    if (type === "string") servlette.write(result);
    else if (type === "object") servlette.write(json(result));
    else if (type === "number") {
      servlette.status(result);
      if (result === 404) return false;
    }
  }

  function serve(request, response) {
    let verbose = configured.verbose;

    verbose("event: [serve]");

    if (!request.servlette) {
      let servlette =
        (request.servlette =
        response.servlette =
          {
            headers_: {},
            output_: [],
            all_cookies_: [],
            post: null,
            status_: 200,
            request: request,
            response: response,
          });

      function status(code) {
        servlette.status_ = code;
      }

      function header(key, value) {
        servlette.headers_[key] = value == null ? "" : value;
      }

      function raw() {
        for (let adx = 0, amx = arguments.length; adx < amx; ++adx)
          servlette.output_.push(arguments[adx]);
      }

      function write() {
        for (let adx = 0, amx = arguments.length; adx < amx; ++adx)
          if (arguments[adx]) servlette.output_.push(arguments[adx].toString());
      }

      function cookie(key, value, options) {
        if (!options) options = {};
        if (options.secure === undefined) options.secure = true;
        if (options.sameSite === undefined) options.sameSite = true;
        if (options.hidden) options.httpOnly = true;
        if (value === null) options.maxAge = 0;
        servlette.all_cookies_.push(
          cookieParser.serialize(key, value, options)
        );
      }

      request.on("data", (data) => {
        verbose("event: [data]");
        if (!request.servlette.post) request.servlette.post = [];
        request.servlette.post.push(data);
      });

      request.on("end", (arg) => {
        verbose("event: [end]");
        let servlette = request.servlette;

        if (servlette.post)
          servlette.post = Buffer.concat(servlette.post).toString();

        let url = decodeURI(request.url.trim());
        let needle = char("?");
        let position = 0;
        for (let umx = url.length; position < umx; ++position)
          if (char(url, position) == needle) break;
        let route = sanitizeRoute(normalize(url.substr(0, position)));
        let preprocessed = url.substr(position + 1);
        let object = decodeQueryString(preprocessed);
        let query = {};
        for (let tag in object) query[tag] = object[tag];

        servlette.servlette = servlette;
        servlette.local = request.connection.localAddress;
        servlette.remote = request.connection.remoteAddress;
        servlette.url = url;
        servlette.route = route;
        servlette.query = query;
        servlette.method = request.method;
        servlette.headers = request.headers;
        servlette.cookies = cookieParser.parse(request.headers.cookie || "");
        servlette.status = status;
        servlette.header = header;
        servlette.raw = raw;
        servlette.read = getCachedFile;
        servlette.write = write;
        servlette.cookie = cookie;
        servlette.json = json;
        servlette.object = JSON.parse;
        servlette.char = char;
        servlette.load = servlette.jalosi = (fileNames, imports, options) =>
          jalosi.load(fileNames, imports || servlette, options);
        servlette.defer = (fileNames, imports, options) =>
          jalosi.defer(fileNames, imports || servlette, options);
        servlette.compile = (scripts, imports, options) =>
          jalosi.compile(scripts, imports || servlette, options);
        servlette.run = (scripts, imports, options) =>
          jalosi.run(scripts, imports || servlette, options);
        servlette.printable = (text) =>
          text.replace(
            /[\u00A0-\u9999<>\&]/gim,
            (glyph) => "&#" + char(glyph) + ";"
          );
        servlette.redirect = function (location) {
          status(302);
          header("location", location || "/");
        };

        verbose("remote:", servlette.remote);
        verbose("method:", servlette.method);
        verbose("headers:", servlette.headers);
        verbose("cookies:", servlette.cookies);
        verbose("url:", servlette.url);
        verbose("route:", servlette.route);
        verbose("query string:", preprocessed);
        verbose("query:", servlette.query);

        try {
          let filterHandled = false,
            indexHandled = false;

          let specials = [configured.path].concat(configured.scripts);

          if (configured.routes.filter)
            filterHandled = handleRoute(servlette, "filter", specials);

          if (filterHandled === undefined)
            indexHandled = handleRoute(
              servlette,
              route,
              configured.scripts,
              configured.root
            );

          if (filterHandled !== true && indexHandled === false) {
            servlette.status(404);
            if (configured.routes.missing)
              handleRoute(servlette, "missing", specials);
            else
              servlette.write(
                `
                 <html>
                  <body>
                   <h1>Error: 404</h1>
                   <h2>Not Found</h2>
                   The requested URL "${route}" was not found on this server
                  </body>
                 </html>
                `
              );
          }
        } catch (error) {
          console.error(error);
        }
        if (servlette.all_cookies_.length)
          header("Set-Cookie", servlette.all_cookies_);
        response.writeHead(
          response.servlette.status_,
          response.servlette.headers_
        );
        for (let odx in response.servlette.output_)
          response.write(response.servlette.output_[odx]);
        response.end();
      });
    }
  }

  const readFileText = (fileName) => readFileSync(fileName, "utf-8");
  const isArray = Array.isArray;
  const isEmpty = (text) => !text || text == "";

  function start(newConfiguration) {
    stop();

    if (newConfiguration) configured = newConfiguration;

    htmlExtensions = configured.htmlExtensions || ["", ".htm", ".html"];
    scriptsExtensions = configured.scriptsExtensions || ["", ".js", ".jso"];

    if (!configured.address) configured.address = "0.0.0.0";

    if (!configured.routes) configured.routes = {};

    if (configured.missing != undefined)
      configured.routes.missing = configured.missing;

    if (configured.filter != undefined)
      configured.routes.filter = configured.filter;

    if (!configured.verbose) configured.verbose = function () {};
    else if (configured.verbose === true) configured.verbose = console.log;

    configured.path = resolve(normalize(configured.path || "."));

    if (!isArray(configured.root))
      configured.root = [(configured.root || "").split(",")];
    for (let rdx in configured.root)
      configured.root[rdx] = configured.path + sep + configured.root[rdx];

    if (!isArray(configured.scripts))
      configured.scripts = [(configured.scripts || "").split(",")];
    for (let sdx in configured.scripts)
      configured.scripts[sdx] = configured.path + sep + configured.scripts[sdx];

    let keys = configured.keys || configured;
    if (keys.key && fileExists(keys.key)) keys.key = readFileText(keys.key);
    if (keys.cert && fileExists(keys.cert)) keys.cert = readFileText(keys.cert);
    if (keys.ca) {
      if (!isArray(keys.ca)) keys.ca = [keys.ca];
      for (let cdx in keys.ca)
        if (fileExists(keys.ca[cdx])) keys.ca = readFileText(keys.ca[cdx]);
    }
    let ssl = !(isEmpty(keys.key) && isEmpty(keys.cert) && isEmpty(keys.ca));
    for (let property in configured) {
      let value = configured[property];
      let type = typeof value;
      if (type === "function") value = "[function]";
      configured.verbose(property, ":", value);
    }

    if (!configured.port) configured.port = ssl ? 443 : 80;
    server = ssl ? https.createServer(keys, serve) : http.createServer(serve);
    server.listen(configured.port, configured.address);
  }

  if (!configured) configured = {};
  if (configured.start) start();
  return { start: start, stop: stop };
};
