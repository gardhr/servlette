`
<html>
 <body style = "font-size:16pt;background-color:dd0030;color:000000">
 Today's date: ${ new Date() }
<br><br>
 Your IP address: ${ remote }
<br><br>
 Requested URL: ${ url }
<br><br>
 Route: ${ route }
<br><br>
 Query: ${ json(query) }
<br><br>
 Cookies: ${ json(cookies) }
<br><br>
 Headers: ${ json(headers, null, "<br><br>") }
<br><br>
<a href = "golden">Golden</a> 
<a href = "metal">Metal</a> 
<a href = "cookies">Cookies</a> 
<a href = "/">Here</a>  
<a href = "source">Source</a>
<a href = "lost">Get lost</a>   
 </body>
</html>
`
