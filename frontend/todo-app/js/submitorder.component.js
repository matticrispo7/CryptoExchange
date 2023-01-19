(function (win) {
  class SubmitOrderComponent {
    #client = null;
    #element = null;

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
      this.#element = document.createElement("div");
      this.#element.className = "col-md-12 align-self-center";
      this.#element.innerHTML = document.querySelector(
        "script#submit-order-template"
      ).textContent;

      // add the event to the form
      const form = this.#element.querySelector('form[name="form-new-order"]');
      form.addEventListener("submit", ($event) => {
        $event.preventDefault();
        this.createOrder($event);
        form.reset();
      });
      return this.#element;
    }

    createOrder(e) {
      const userid = localStorage.getItem("id");
      /*
       build the observable out of this promise returned by the HTTP request
       call the "getOrders()" from DashboardPreviewComponent to refresh the order to show in the dashboard preview 
      */
      const observer = {
        next: (value) => {
          console.log();
        },
        error: (err) => {
          console.log(err);
        },
        complete: () => {
          console.log();
        },
      };
      //subscribe to the observable to trigger the HTTP request
      this.postOrdersObservable(userid, e).subscribe(observer);
    }

    /**
     * Create an Observable out of the Promise returned by POST method
     * @param userid  ID used to fetch the data for the right user from the endpoint
     * @return {Observable} A "cold" Observable (execution of the HTTP request is deferred until someone subscribe to this Observable)
     */
    postOrdersObservable(userid, form) {
      // get the data submitted in the form
      const formdata = new FormData(form.target);
      var select = document.getElementById("select-order-type");
      let amount = formdata.get("amount");
      let price = formdata.get("price");
      let type = select.value == "sell-order" ? "SELL" : "BUY";
      const { from } = rxjs;
      return from(this.#client.post("/order", { amount, price, userid, type }));
    }
  }

  /* Exporting component */
  win.SubmitOrderComponent ||= SubmitOrderComponent;
})(window);
