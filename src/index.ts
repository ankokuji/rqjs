const hasSelf = typeof self !== "undefined";

const envGlobal = hasSelf ? self : global;

/**
 *
 *
 * @interface ImportConfig
 */
interface ImportConfig {
  /**
   * Config the baseUrl module should be fetch from.
   *
   * @type {string}
   * @memberof ImportConfig
   */
  baseUrl: string;
  /**
   * Definitions of fetch path for each module.
   *
   * @type {ImportPaths}
   * @memberof ImportConfig
   */
  paths: ImportPaths;
}

/**
 * Map of path definitions.
 *
 * @interface ImportPaths
 */
interface ImportPaths {
  [alias: string]: string;
}

/**
 * Cache of imported module.
 *
 * @interface Loaders
 */
interface Loaders {
  [key: string]: ModuleLoader;
}

/**
 * Module loader.
 *
 * @interface moduleLoader
 */
interface ModuleLoader {
  moduleName?: string;
  id: string;
  instantiationPromise?: Promise<string>;
  exec?: () => Promise<any>;
  loadPromise: Promise<string>;
  dependencies?: string[];
  module?: any;
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

  public require(dependencies: string[], callback: (...args: any[]) => void) {
    this.__require(dependencies, callback);
  }

  public config(importConfig: ImportConfig) {
    const { baseUrl, paths } = importConfig;
    this.baseUrl = baseUrl;
    this.modulePaths = paths;
  }

  private __require(
    dependencies: string[],
    callback: (...args: any[]) => void
  ): void {
    // execute callback
    this.curryExec(this, dependencies, callback)();
  }

  /**
   * Define a module without dependencies.
   *
   * @param {string} id
   * @param {(...args: any[]) => any} callback
   * @memberof Rqjs
   */
  public define(id: string, callback: (...args: any[]) => any): void;
  /**
   * Define a module with dependencies.
   *
   * @param {string} id
   * @param {string[]} dependencies
   * @param {(...args: any[]) => any} callback
   * @memberof Rqjs
   */
  public define(
    id: string,
    dependencies: string[],
    callback: (...args: any[]) => any
  ): void;
  /**
   * Implementation of define.
   *
   * @param {string} id
   * @param {(string[] | typeof callback)} dependenciesOrCallback
   * @param {(...args: any[]) => any} [callback]
   * @memberof Rqjs
   */
  public define(
    id: string,
    dependenciesOrCallback: string[] | typeof callback,
    callback?: (...args: any[]) => any
  ) {
    if (typeof dependenciesOrCallback === "function") {
      this.__define(id, [], dependenciesOrCallback);
    } else if (dependenciesOrCallback && callback) {
      this.__define(id, dependenciesOrCallback, callback);
    } else {
      throw new Error(`[rqjs] Error in calling method "define"`);
    }
  }

  private __define(
    id: string,
    dependencies: string[],
    callback: (...args: any[]) => any
  ) {
    let loader = this.loaders[id];
    if (
      this.loaders.hasOwnProperty(id) &&
      loader !== undefined &&
      loader["exec"] !== undefined
    ) {
      throw new Error(`[rqjs] Duplicate registration for module name "${id}"`);
    }

    const exec = this.curryExec(this, dependencies, callback);

    if (loader) {
      loader.exec = exec;
      this.loaders[id] = loader;
    } else {
      this.loaders[id] = {
        id,
        loadPromise: Promise.resolve(id),
        exec
      };
    }
  }

  /**
   * Load dependencies, execute module function, return the export.
   *
   * @private
   * @param {Rqjs} instance
   * @param {string[]} dependencies
   * @param {(...args: any[]) => any} callback
   * @returns {() => Promise<any>}
   * @memberof Rqjs
   */
  private curryExec(
    instance: Rqjs,
    dependencies: string[],
    callback: (...args: any[]) => any
  ): () => Promise<any> {
    return function() {
      const depLoaders = instance.getAllLoaders(instance, dependencies);
      return Promise.all(depLoaders.map(loader => loader.loadPromise)).then(
        (ids: string[]) => {
          return Promise.all(
            ids.map((id: string) => {
              return instance.execLoader(instance, id);
            })
          ).then(loaders => {
            const args = loaders.map(loader => loader.module);
            return callback.apply(undefined, args);
          });
        }
      );
    };
  }

  /**
   * Invoke execute function of loader and return.
   *
   * @private
   * @param {Rqjs} instance
   * @param {string} id
   * @returns {Promise<ModuleLoader>}
   * @memberof Rqjs
   */
  private execLoader(instance: Rqjs, id: string): Promise<ModuleLoader> {
    const loader = instance.loaders[id];
    if (loader.module) {
      return Promise.resolve(loader);
    } else {
      if (!loader.exec) {
        throw new Error(
          `[rqjs] Can't get module ${id}'s definition. Did you register module properly?`
        );
      }
      return loader
        .exec()
        .then(_export => {
          loader.module = _export;
        })
        .then(() => loader);
    }
  }

  /**
   * Create all loader of deps.
   *
   * @private
   * @param {Rqjs} instance
   * @param {string[]} deps
   * @returns {ModuleLoader[]}
   * @memberof Rqjs
   */
  private getAllLoaders(instance: Rqjs, deps: string[]): ModuleLoader[] {
    return deps.map(dep => {
      return instance.getLoader(instance, dep);
    });
  }

  /**
   * @deprecated
   *
   * @private
   * @param {Rqjs} instance
   * @param {string[]} deps
   * @returns
   * @memberof ImportJS
   */
  private loadDependencies(instance: Rqjs, deps: string[]) {
    return Promise.all(
      deps.map(function(id) {
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
   * @returns {ModuleLoader}
   * @memberof Rqjs
   */
  private getLoader(instance: Rqjs, id: string): ModuleLoader {
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
