"use strict";
(function (win) {
  class HomeComponent {
    // attributes
    #element = null;
    #client = null;
    #components = [];
    /**
     * Instances this component.
     * @param client {RestClient} A REST client
     */
    constructor(client) {
      this.#client = client;
    }

    /**
     * Destroys this component, removing it from it's parent node.
     */
    destroy() {
      this.#element.remove();
    }

    async init() {
      // create the main div which will contain all the other html elements ==> USER INFO div
      this.#element = document.createElement("div");
      this.#element.className = "container";
      const userid = localStorage.getItem("id");
      const token = localStorage.getItem("jwt");
      if (token) {
        // instantiate the user-info component and append it as child of this.#element
        let userComp = new UserInfoComponent(this.#client, this.#components);
        let userEl = await userComp.init();
        this.#element.appendChild(userEl); // add the element as a child of the div with class "home"
        this.#components.push(userComp); // save the component add so it's possible to delete it

        // create the div "container" and append it as child of this.#element
        let container = document.createElement("div");
        container.className = "row";
        container.id = "data";
        this.#element.appendChild(container);

        // fill the div(".container") with the ORDER BOOK template and the submit order template
        let root = this.#element.querySelector("#data");
        let obComp, obEl, sbComp, sbEl;

        obComp = new OrderBookComponent(this.#client);
        obEl = await obComp.init();
        await root.appendChild(obEl); // add the element as child of the div with class "container"
        this.#components.push(obComp); // save the component add so it's possible to delete it

        // create the div with the flex column that contains the submit order and the dashoard template
        const el = document.createElement("div");
        el.classList = "col-md-8";
        let row = document.createElement("div");
        row.classList = "row h-100";
        el.appendChild(row);

        // fill the div(".container") with the SUBMIT ORDER template and the submit order template
        sbComp = new SubmitOrderComponent(this.#client);
        sbEl = await sbComp.init();
        await row.appendChild(sbEl);
        this.#components.push(sbComp);
        // fill the div(".container") with the SUBMIT ORDER template and the submit order template
        const dashPrevComp = new DashboardPreviewComponent(this.#client);
        let dashPrevEl = await dashPrevComp.init();
        await row.appendChild(dashPrevEl);
        await root.appendChild(el);
        this.#components.push(dashPrevComp); // save the component add so it's possible to delete it
        // register the click event for the btn in the dashboard preview template
        const btn = this.#element.querySelector("#btnDashboardPreview");
        btn.addEventListener("click", async ($event) => {
          $event.preventDefault();
          await this.loadDashboard();
        });
      }
      return this.#element;
    }

    /**
     * Function used as callback for the dashboard button
     */
    async loadDashboard() {
      // remove every component (but the user info div) from the page
      this.#components.forEach((c) => c.destroy());
      // load the dashboard component into the page
      const dashComponent = new DashboardComponent(this.#client);
      let dashEl = await dashComponent.init();
      const root = document.querySelector(".content #root");
      root.innerHTML = "";
      root.appendChild(dashEl);
    }
  }

  /* Exporting component */
  win.HomeComponent ||= HomeComponent;
})(window);
