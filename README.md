# rqjs

`rqjs` is a minimum AMD, CMD module loader for Javascript.

For now it just implement basic functions to keep minimum size.

# Intallation

Use yarn to install `rqjs`:
```shell
$ yarn add rqjs
```

# Example

You can define a module by import es module of `rqjs`:
```javascript
import rqjs from "rqjs";

rqjs.define("moduleA", function() {
  const moduleExport = ...;
  return moduleExport;
})
```

Or you can define a module with dependencies:
```javascript
import rqjs from "rqjs";

rqjs.define("moduleB", ["moduleA"], function(moduleA) {
  const moduleExport = someFunction(moduleA);
  return moduleExport;
})
```

Then you can execute a function by:
```javascript
import rqjs from "rqjs";

rqjs.require(["moduleA", "moduleB"], function(moduleA, moduleB) {
  const moduleExport = someFunction(moduleA, moduleB);
  return moduleExport;
})
```

You can load `rqjs.min.js` in a HTML page:
```html
<html>
<head></head>
<body>
  <script src="./rqjs.min.js" ></script>
</body>
</html>
```
Then `rqjs` will be mounted on `global` Object, which is `window` object in browser. 

# Interface