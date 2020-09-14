var { metallicRatio } = load("private/metallic.js");
var ratio = metallicRatio(Math.floor(Math.random() * Math.pow(2, 6)));
cookie("ratio", ratio);
return `
<html>
 <body style = "font-size:16pt;background-color:ddaf30;color:000000">
 
 Random ratio is ${ratio} 
 <br><br>

<a href = "/">Home</a> 
<a href = "metal">Generate</a>  
<a href = "golden">Golden</a>  
<a href = "cookies">Cookies</a> 
<a href = "source">Source</a> 
  
 </body>
</html>
`;
