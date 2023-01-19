"use strict";
(function (win) {
  class DashboardPreviewComponent {
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
        "script#dashboard-preview-template"
      ).textContent;

      const token = localStorage.getItem("jwt");
      const userid = localStorage.getItem("id");
      return this.#element;
    }

    /**
     * Subscribe to the observable created by the function "getOrdersObservable" to actually trigger the HTTP request, then create
     * the observer (what need to be done with the observable)
     * @param userid {string} ID used to fetch the data for the right user from the endpoint
     */
    getOrders(userid) {
      // GET the orders for the user with the given ID (the route will be GET => /users/:id/orders)
      try {
        let orders = []; // list which contain all the orders fetched for this user
        const observer = {
          next: (value) => {
            orders.push(value);
          },
          error: (err) => {
            console.log(`[dashboard-preview-observer] error: ${err}`);
          },
          complete: () => {
            this.appendOrders(...orders);
          },
        };
        this.getOrdersObservable(userid).subscribe(observer);
      } catch (e) {
        console.error("Something went wrong getting orders", e);
      }
    }

    /**
     * Create an Observable out of the Promise returned by GET method
     * @param userid {string} ID used to fetch the data for the right user from the endpoint
     * @return {Observable} A "cold" Observable (execution of the HTTP request is deferred until someone subscribe to this Observable)
     */
    getOrdersObservable(userid) {
      const { from, map, tap, pipe } = rxjs;
      return from(this.#client.get(`users/${userid}/orders`));
    }

    /**   Get the orders from the OrderBook, filter them by the userID, sort them and then show the first N latest orders
     * @param orders orders list
     * @param userid
     * @returns {void}
     **/
    appendOrders(orders, userid) {
      const root = document.querySelector(".content #root");
      const table = root.querySelector("#dash-preview");
      // sort the orders in DESC order by timestamp such that it's possible to show only the last N orders
      const subsetOrders = orders
        .filter((o) => o.userID == userid)
        .sort((a, b) => (b.timestamp ? b.timestamp > a.timestamp : a.timestamp))
        .slice(0, 2);

      let ord = orders.filter((o) => o.userID == userid);

      // get the tbody from the root; clear the tbody's innerHTML before inserting the orders (if there are any children) such that it's possible to update the preview with the newly submitted orders
      let tbody = root.querySelector("#tbody-dash-preview");
      if (tbody != null) {
        // remove children from tbody (if there are any)
        if (tbody.childElementCount != 0) {
          while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
          }
        }
        subsetOrders.forEach((o) => {
          // build the table row for this order
          let tr = document.createElement("tr");
          let date = new Date(o.timestamp * 1000);
          tr.innerHTML = `<td>${o.type}</td><td>${o.amount}</td><td>${
            o.price
          }</td><td>${o.status}</td><td>${date.toLocaleDateString(
            "en-GB"
          )}</td>`;
          tbody.appendChild(tr);
        });
      }
    }
  }

  // Exporting component
  win.DashboardPreviewComponent ||= DashboardPreviewComponent;
})(window);
