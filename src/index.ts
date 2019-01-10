const hasSelf = typeof self !== "undefined";

const envGlobal = hasSelf ? self : global;

/**
 *
 *
 * @interface ImportConfig
 */
interface ImportConfig {
  baseUrl: string;
  paths: ImportPaths;
}

interface ImportPaths {
  [alias: string]: string;
}

/**
 * Cache of imported module.
 *
 * @interface Loaders
 */
interface Loaders {
  [key: string]: moduleLoader;
}

/**
 * Module loader.
 *
 * @interface moduleLoader
 */
interface moduleLoader {
  moduleName?: string;
  id: string;
  loadPromise: Promise<string>;
  f?: Function;
}

/**
 *
 *
 * @class ImportJS
 */
class Rqjs {
  private loaders: Loaders = {};

  /**
   * Default base url for module.
   *
   * @private
   * @type {string}
   * @memberof ImportJS
   */
  private baseUrl: string = "./";

  private modulePaths: ImportPaths = {};

  /**
   * Creates an instance of ImportJS.
   * Module will export an instance of ImportJS,
   * so there is no arguments passed to constructor.
   *
   * @memberof ImportJS
   */
  public constructor() {}

  public require() {}

  public config(importConfig: ImportConfig) {
    const { baseUrl, paths } = importConfig;
    this.baseUrl = baseUrl;
    this.modulePaths = paths;
  }

  private __require(
    dependencies: string[],
    callback: (...args: any[]) => void
  ) {}

  public define() {}

  private __define(
    modulename: string,
    dependencies: string[],
    callback: (...args: any[]) => any
  ) {
    if (
      this.loaders.hasOwnProperty(modulename) &&
      this.loaders[modulename] !== undefined
    ) {
      throw new Error(
        `[Importjs] Duplicate registration for module name "${modulename}"`
      );
    }
  }

  /**
   * @deprecated
   *
   * @private
   * @param {Rqjs} instance
   * @param {string[]} dep
   * @returns
   * @memberof ImportJS
   */
  private loadDependencies(instance: Rqjs, dep: string[]) {
    return Promise.all(
      dep.map(function(id) {
        return instance.loadScriptDependency(instance.resolvePath(id), id);
      })
    );
  }

  /**
   * 
   *
   * @private
   * @param {Rqjs} instance
   * @param {string} id
   * @returns {moduleLoader}
   * @memberof Rqjs
   */
  private getLoader(instance: Rqjs, id: string): moduleLoader {
    let loader = instance.loaders[id];
    if (loader) {
      return loader;
    }

    const loadPromise = instance.loadScriptDependency(
      instance.resolvePath(id),
      id
    );

    return (instance.loaders[id] = {
      id,
      loadPromise
    });
  }

  /**
   * Load dependency by url.
   *
   * @private
   * @param {string} url
   * @param {string} id
   * @returns
   * @memberof ImportJS
   */
  private loadScriptDependency(url: string, id: string): Promise<string> {
    return new Promise(function(resolve, reject) {
      const script = document.createElement("script");
      script.charset = "utf-8";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.addEventListener("error", function() {
        reject(new Error("Error loading " + url));
      });
      script.addEventListener("load", function() {
        document.head.removeChild(script);
        // Note URL normalization issues are going to be a careful concern here
        resolve(id);
      });
      script.src = url;
      document.head.appendChild(script);
    });
  }

  /**
   * A naive implementation.
   *
   * @private
   * @param {string} id
   * @returns
   * @memberof ImportJS
   */
  private resolvePath(id: string) {
    return this.baseUrl + id;
  }

  private __mount(modulename: string, module: any) {
    this.loaders[modulename] = module;
  }
}

// Mount rqjs on global object.
(envGlobal as any).rqjs = new Rqjs();

export default Rqjs;
