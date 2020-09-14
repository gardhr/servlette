write(
  `<html><body style = "font-size:20pt;background-color:207ed3;color:30fadd">
  Cookies:<br>
  `
);
for (let tag in query) {
  let value = query[tag]
  let options = {maxAge: value === "null" ?  0 : 60 * 60 * 24 * 52 * 11 * 2343}
  cookie(tag, value, options);
}  
var hasCookies = false 
for (let tag in cookies) {
  hasCookies = true
  write(tag, " = ", cookies[tag], "<br>");
}
if(!hasCookies)
  write("No cookies found!<br>");
write(`
Set a cookie by adding it to the query string:<br>
<a href = "cookies?example=12345">cookies?example=12345</a><br>
Delete a cookie:<br>
<a href = "cookies?example=null">cookies?example=null</a><br>
<a href = "golden">Golden</a> 
<a href = "metal">Metal</a> 
<a href = "/">Home</a>
<a href = "cookies">Refresh</a>  
</body></html>`);
