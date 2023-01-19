"use strict";

(function (win) {
  class DashboardComponent {
    #client = null;
    #element = null;
    #components = [];
    #subscription = null;
    #orders = []; // list with the orders such that, when updating the table, only the orders that there weren't previously in this list will be added
    #handlers = []; // list with handlers associated to each button in tr

    constructor(client) {
      this.#client = client;
    }

    /**
     * Destroys this component, removing it from it's parent node.
     */
    destroy() {
      this.#element.remove();
      this.#subscription.unsubscribe(); // unsubscribe also from the observable
    }

    async init() {
      this.#element = document.createElement("div");
      this.#element.className = "container";
      const userid = localStorage.getItem("id");
      const token = localStorage.getItem("jwt");
      if (token) {
        // instantiate the user-info component and append it as child of this.#element
        let userComp = new UserInfoComponent(this.#client);
        let userEl = await userComp.init();
        this.#element.appendChild(userEl); // add the element as a child of the div with class "home"
        this.#components.push(userComp); // save the component add so it's possible to delete it

        // create the div and append it as child of this.#element
        let container = document.createElement("div");
        container.className = "row";

        let dashboardEl = document.createElement("div");
        dashboardEl.className = "col-md-12";
        dashboardEl.innerHTML = document.querySelector(
          "script#dashboard-template"
        ).textContent;

        container.appendChild(dashboardEl);
        this.#element.appendChild(container);

        // configure the event for the btn to return to the homepage
        const btn = this.#element.querySelector("#btnHome");
        btn.addEventListener("click", async ($event) => {
          const root = document.querySelector(".content #root");
          $event.preventDefault();
          this.#components.forEach((c) => c.destroy()); // delete the COMPONENTS created
          this.destroy();
          // delete also the orders in the list
          this.#orders = [];
          // delete also the handlers in this.#handlers
          this.#handlers.forEach((h) => h.unregister());
          root.innerHTML = ""; // delete every HTML ELEMENT (children of this root)
          const homeComp = new HomeComponent(this.#client);
          let homeEl = await homeComp.init();
          root.appendChild(homeEl);
        });
        this.updateDashboard(userid);
      }

      return this.#element;
    }

    updateDashboard(userid) {
      const { of } = rxjs;
      const { mergeMap, repeat, delay, catchError } = rxjs.operators;
      const observer = {
        next: (orders) => {
          this.fillDashboard(orders);
          this.updateUserInfo(orders);
        },
        error: (err) => {
          console.log(`[dasboard-observer] err: ${err}`);
        },
        complete: () => {
          console.log();
        },
      };

      // poll the DB to get the orders
      this.#subscription = of({})
        .pipe(
          mergeMap((_) => this.#client.get(`users/${userid}/orders`)),
          catchError((err) => {
            //console.log(`Error in observable: ${JSON.stringify(err)}`);
            if (err.status == 401) {
              // get a new access token
              this.updateToken();
            }
            return of();
          }),
          delay(500),
          repeat()
        )
        .subscribe(observer);
    }

    /**
     * Get a new access token by sending a POST request to "/tokens" (with the refreshToken in the req.body) and update the jwt in the localStorage
     */
    updateToken() {
      const { from } = rxjs;
      from(
        this.#client.post("/tokens", {
          refreshToken: localStorage.getItem("refreshToken"),
        })
      ).subscribe((result) => {
        localStorage.setItem("jwt", result.accessToken);
      });
    }

    /**
     * This function will filter the orders for the given userID and show them in DESC order based on timestamp.
     * Also, for the orders suitable, a DELETE button will be shown in the row associated to that order.
     * @param orders list of orders get from the DB
     * @returns {void}
     */
    fillDashboard(orders) {
      // get the table element in the template ==> will be filled with rows == orders
      const root = document.querySelector(".content #root");
      const tbody = root.querySelector("#tbody-dashboard");

      // sort the orders such that it's possible to show only the latest N orders
      orders.sort((a, b) =>
        a.timestamp ? a.timestamp > b.timestamp : b.timestamp
      );

      // add to the existing table only the rows that represents new order without destroying every time the tables rows and creating them
      orders.forEach((o) => {
        let addBtn = this.checkAddBtn(orders, o); // flag to check if it's possible to show the DEL btn for this order
        // check if this order is already in the list
        if (!this.checkObjectInArray(this.#orders, o)) {
          // order not present => save it in the list and create the row and add it
          this.#orders.push(o);
          // build the table row for this order
          let tr = document.createElement("tr");
          let date = new Date(o.timestamp * 1000);
          tr.innerHTML = addBtn
            ? `<td><button id="${
                o.id
              }"><i class="fa-solid fa-trash" style="color:rgb(234, 236, 239)"></i></td><td>${
                o.id
              }</td><td>${o.type}</td><td>${o.amount}</td><td>${
                o.price
              }</td><td>${o.status}</td><td>${date.toLocaleDateString(
                "en-GB"
              )} ${date.toLocaleTimeString("it-IT")}</td><td>${o.refID}</td>`
            : `<td></td><td>${o.id}</td><td>${o.type}</td><td>${
                o.amount
              }</td><td>${o.price}</td><td>${
                o.status
              }</td><td>${date.toLocaleDateString(
                "en-GB"
              )} ${date.toLocaleTimeString("it-IT")}</td><td>${o.refID}</td>`;

          // the orders were sorted in ASC order with respect to the timestamp so every time the new order will be put as first child
          tbody.prepend(tr);
          if (addBtn) {
            // register the event to the button and then save that handler
            this.registerButtonEvent(o.id);
          }
        } else {
          // based on "addBtn", check if this order's row needs to be updated (it means that the DELETE btn needs to be removed)
          if (!addBtn) {
            // get the btn with ID = this order's ID, delete the handler associated and delete the button
            let btn = document.getElementById(o.id);
            if (btn != null) {
              this.#handlers
                .filter((t) => t.element.id == o.id)
                .map((m) => {
                  m.unregister();
                });
              btn.remove();
            }
          }
        }
      });
    }

    /**  Function that checks, when an order is being added to the tables, if the "DELETE" button needs to be showed or not
    @param  list the orders list
    @param  ord the order used for the check
    @returns {void}
    **/
    checkAddBtn(list, ord) {
      /* if this order hasn't a refID it means it's in the SUBMITTED state so i'm going to check in the "orders" list if there's any order with refID == this order's id.
      If so, it means that i don't have to put the "DELETE" button in this table's row (of the order passed as parameter) because there is a new transaction with updated state
      about this order.
      If this order has SUBMITTED state (so refID null) and there's NOT any other order with refID == this order's id, so I can put the "DELETE" button to this table's row
      because there's not a new transaction for this order  */
      let arr = [];
      if (ord.status == "SUBMITTED") {
        // check if there are any other orders related to this one (orders with status PARTIALLY FILLED or FILLED)
        arr = list.filter((t) => ord.id === t.refID && ord.status !== t.status);
        if (arr.length > 0) {
          return false;
        } else {
          // there's not any other order related to this one => show the DELETE button
          return true;
        }
      } else {
        return false;
      }
    }

    /**  Function to remove (= move to order's status CANCELLED) an order and then unregister also the handler associated to the order's button
    @param  id the order id used to find the button in the DOM (the button will have as id the same as the order associated to delete if the button is pressed)
    @param btn the button that needs to be removed from the DOM
    @returns {void}
    **/
    removeOrder(id, btn) {
      const { from } = rxjs;
      //send DEL req to "delete" (update the order status to CANCELLED) order
      from(this.#client.del(`order/${id}`)).subscribe((result) =>
        console.log(`DEL result for order ${id}: ${result}`)
      );
      // remove this handler from this.#handler to avoid memory leak
      this.#handlers
        .filter((t) => t.element.id == id)
        .map((m) => m.unregister());
      // remove the btn from the DOM
      btn.remove();
    }

    /**  Function to add an handler to a button
    @param  orderid the order id used to find the button in the DOM (the button will have as id the same as the order associated to delete if the button is pressed)
    @returns {void}
    **/
    registerButtonEvent(orderid) {
      // since the button in the order's row have both the same id, it's possible to identify the button by this id
      let btn = document.getElementById(orderid);
      const hdlr = new Handler("click", btn, () =>
        this.removeOrder(orderid, btn)
      );
      this.#handlers.push(hdlr);
    }

    /**
     * Function called by the observable when new values are emitted. It will update the user's info.
     * @param orders orders list
     */
    updateUserInfo(orders) {
      const userid = localStorage.getItem("id");
      const info = new UserInfoComponent(this.#client);
      let span_btc = root.querySelector("#span-btc");
      let span_balance = root.querySelector("#span-balance");
      if (span_btc != null && span_balance != null) {
        info.updateUserData(orders, userid);
      }
    }

    /**  Function to check if an object is already present in a list
    @param  arr list to check in
    @param obj object to find in the list
    @returns true if the object was found
    **/
    checkObjectInArray(arr, obj) {
      return arr.some((item) =>
        Object.keys(item).every((key) => item[key] === obj[key])
      );
    }
  }

  /* Exporting component */
  win.DashboardComponent ||= DashboardComponent;
})(window);
