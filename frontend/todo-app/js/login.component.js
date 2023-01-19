`use strict`;

(function (win) {
  /**
   * A login component.
   */
  class LoginComponent extends EventEmitter {
    /** @type {HTMLElement} */
    #element;
    /** @type {RestClient} */
    #client;
    /** @type {Handler[]} */
    #handlers = [];

    /**
     * Instances a new `LoginComponent`.
     * @param client {RestClient} The REST client
     */
    constructor(client) {
      super();
      this.#client = client;
    }

    /**
     * Destroys this component, removing it from it's parent node.
     */
    destroy() {
      this.#handlers.forEach((h) => h.unregister());
      this.#element.remove();
    }

    /**
     * Initializes the component.
     * @return {Promise<HTMLElement>} The root element for this component.
     * => Viene invocato per costruire i pezzi di DOM che mi servono ==> ASINCRONO quindi "async" <=
     */
    async init() {
      this.#element = document.createElement("div");
      this.#element.className = "container";
      this.#element.innerHTML = document.querySelector(
        "script#login-template"
      ).textContent;

      const btn = this.#element.querySelector(".sub");
      const hdlr = new Handler("click", btn, () => this.login());
      this.#handlers.push(hdlr);
      // noinspection ES6MissingAwait
      this.getTokensIfAuthorized();
      return this.#element;
    }

    async getTokensIfAuthorized() {
      // get the jwt and the refreshToken by the URL params and emit the authenticated event
      const url = new URL(document.URL);
      const jwt = url.searchParams.get("token");
      const refresh = url.searchParams.get("refresh");
      const userid = url.searchParams.get("id");
      console.log(`**** jwt: ${jwt} --- refresh: ${refresh}`);
      if (!jwt) {
        return;
      }
      localStorage.setItem("jwt", jwt);
      localStorage.setItem("refreshToken", refresh);
      localStorage.setItem("id", userid);
      const page = "http://localhost:9000";
      this.emit("authenticated", {
        jwt,
        refresh,
        userid,
        page,
      });
    }

    /* deprecated*/
    login() {
      const url = new URL(document.URL);
      url.pathname = "/api/login";
      console.debug("Redirecting to login URL...");

      window.location = url.href; // redirect
    }
  }

  win.LoginComponent ||= LoginComponent;
})(window);
