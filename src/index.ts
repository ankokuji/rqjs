/**
 *
 * NOTE: Avoid using async/await functions to reduce file size.
 *
 * Minimal implementation of module loader.
 *
 */
(function() {
  const hasSelf = typeof self !== "undefined";
  const envGlobal = hasSelf ? self : global;

  /**
   * Config of Rqjs.
   *
   * @interface RqjsConfig
   */
  interface RqjsConfig {
    /**
     * Config the baseUrl module should be fetch from.
     *
     * @type {string}
     * @memberof RqjsConfig
     */
    baseUrl: string;
    /**
     * Definitions of fetch path for each module.
     *
     * @type {ImportPaths}
     * @memberof RqjsConfig
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
    /**
     * @deprecated
     *
     * @type {string}
     * @memberof ModuleLoader
     */
    moduleName?: string;
    /**
     * Module ID.
     *
     * @type {string}
     * @memberof ModuleLoader
     */
    id: string;
    /**
     * Maybe other format of module will use this.
     *
     * @deprecated
     *
     * @type {Promise<string>}
     * @memberof ModuleLoader
     */
    instantiationPromise?: Promise<string>;
    /**
     * Implementation of module.
     *
     * @memberof ModuleLoader
     */
    exec?: () => Promise<any>;
    /**
     * Load promise of module.
     * If module's code is loaded, this will be resolved.
     *
     * @type {Promise<string>}
     * @memberof ModuleLoader
     */
    loadPromise: Promise<string>;
    /**
     * The dependencies of module.
     * No use because actually deps was closured into exec function.
     *
     * @deprecated
     *
     * @type {string[]}
     * @memberof ModuleLoader
     */
    dependencies?: string[];
    /**
     * The export of module.
     *
     * @type {*}
     * @memberof ModuleLoader
     */
    module?: any;
  }

  /**
   *
   *
   * @class Rqjs
   */
  class Rqjs {
    private loaders: Loaders = {};

    /**
     * Default base url for module.
     *
     * @private
     * @type {string}
     * @memberof Rqjs
     */
    private baseUrl: string = "./";

    private modulePaths: ImportPaths = {};

    /**
     * Creates an instance of Rqjs.
     * Module will export an instance of Rqjs,
     * so there is no arguments passed to constructor.
     *
     * @memberof Rqjs
     */
    public constructor() {}

    public require(dependencies: string[], callback: (...args: any[]) => void) {
      this.__require(dependencies, callback);
    }

    /**
     * Config the baseUrl, paths of each module
     * in order to fetch from remote.
     *
     * @param {RqjsConfig} importConfig
     * @memberof Rqjs
     */
    public config(importConfig: RqjsConfig) {
      const { baseUrl, paths } = importConfig;
      this.baseUrl = baseUrl;
      this.modulePaths = paths;
    }

    /**
     * Import a module manually and return a Promise with module export.
     *
     * @param {string} id
     * @returns {Promise<any>}
     * @memberof Rqjs
     */
    public import(id: string): Promise<any> {
      return this.loadDependenciesAndExecAll(this, [id])
        .then(([loader]) => {
          return loader.module;
        })
    }

    /**
     * Call the function after load all dependencies.
     *
     * @private
     * @param {string[]} dependencies
     * @param {(...args: any[]) => void} callback
     * @memberof Rqjs
     */
    private __require(
      dependencies: string[],
      callback: (...args: any[]) => void
    ): void {
      // execute callback
      this.higherOrderExec(this, dependencies, callback)();
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
        throw new Error(
          `[rqjs] Duplicate registration for module name "${id}"`
        );
      }

      // Use higher order function because module need not to be executed immediately.
      // Otherwise this should be invoded when this module is depended.
      const exec = this.higherOrderExec(this, dependencies, callback);

      if (loader) {
        loader.exec = exec;
        this.loaders[id] = loader;
      } else {
        this.loaders[id] = { id, loadPromise: Promise.resolve(id), exec };
      }
    }

    /**
     * Load dependencies, execute module function, return the export.
     * First load all denpendencies and inject them as argument into function callback.
     *
     * @private
     * @param {Rqjs} instance
     * @param {string[]} dependencies
     * @param {(...args: any[]) => any} callback
     * @returns {() => Promise<any>}
     * @memberof Rqjs
     */
    private higherOrderExec(
      instance: Rqjs,
      dependencies: string[],
      callback: (...args: any[]) => any
    ): () => Promise<any> {
      return function() {
        return instance
          .loadDependenciesAndExecAll(instance, dependencies)
          .then(loaders => {
            const args = loaders.map(loader => loader.module);
            return callback.apply(undefined, args);
          });
      };
    }

    /**
     * Load dependencies and iterally execute all modules to get export.
     *
     * @private
     * @param {Rqjs} instance
     * @param {string[]} dependencies
     * @returns {Promise<any[]>}
     * @memberof Rqjs
     */
    private loadDependenciesAndExecAll(
      instance: Rqjs,
      dependencies: string[]
    ): Promise<ModuleLoader[]> {
      const depLoaders = instance.getAllLoaders(instance, dependencies);
      return Promise.all(depLoaders.map(loader => loader.loadPromise)).then(
        (ids: string[]) => {
          return Promise.all(
            ids.map((id: string) => {
              return instance.execLoader(instance, id);
            })
          );
        }
      );
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
            `[rqjs] Can't get module ${id}'s definition. Did you register module properly? \n` +
              `Please check config for baseUrl and paths is right:\n` +
              `-- baseUrl: ${instance.baseUrl} -- path: ${instance.modulePaths[
                id
              ] || ""}`
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
     * Init loader of target module. 
     * If module doesn't exit then load the module. 
     * Mount the load promise on loader.
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

      return (instance.loaders[id] = { id, loadPromise });
    }

    /**
     * Load dependency from remote url.
     *
     * @private
     * @param {string} url
     * @param {string} id
     * @returns
     * @memberof Rqjs
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
          (document.head as HTMLHeadElement).removeChild(script);
          // Note URL normalization issues are going to be a careful concern here
          resolve(id);
        });
        script.src = url;
        (document.head as HTMLHeadElement).appendChild(script);
      });
    }

    /**
     * A naive implementation.
     * This should be rewrite to be more robust.
     *
     * @private
     * @param {string} id
     * @returns
     * @memberof Rqjs
     */
    private resolvePath(id: string) {
      const path = this.modulePaths[id] || id;
      return this.baseUrl + path;
    }

  }

  // Avoid instantiation.
  const rqjs = (envGlobal as any).rqjs || new Rqjs();

  // Mount rqjs on global object.
  (envGlobal as any).rqjs = rqjs;
})();
