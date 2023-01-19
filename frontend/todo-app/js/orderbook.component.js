"use strict";
(function (win) {
  class OrderBookComponent {
    #client = null;
    #element = null;
    #subscription = null;

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
      this.#element.className = "col-md-4";
      this.#element.innerHTML = document.querySelector(
        "script#order-book-template"
      ).textContent;

      let userid = localStorage.getItem("id");
      this.updateOrderBook();
      return this.#element;
    }

    /**
     * Function that updates the OrderBooks, getting the order from the DB.
     * When the GET request fails (the access token expires), the observable catch the error and send a request to get a new access token
     */
    updateOrderBook() {
      const { of, from } = rxjs;
      const { mergeMap, repeat, delay, catchError } = rxjs.operators;
      const observer = {
        next: (value) => {
          this.showOrders(value);
          this.updateDashboardPreview(value);
          this.updateUserInfo(value);
        },
        complete: () => {
          console.log();
        },
      };

      // get orders (and build levels) from the API
      this.#subscription = of({})
        .pipe(
          mergeMap((_) => from(this.#client.get("/orders"))),
          catchError((err) => {
            console.log(`Error in OB observable: ${JSON.stringify(err)}`);
            if (err.status == 401) {
              // get a new access token
              this.updateToken();
              return of();
            }
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
     * Function used to process the orders retrieved by the observable and build the corresponding levels in the OrderBook.
     * To keep it simple, at most N=4 levels are shown for both the tables in the order book
     * @param orders
     */
    showOrders(orders) {
      let levels = []; // will contains the OB levels as object {type: "BUY/SELL", price: x, amount: x}
      const root = document.querySelector(".content #root");
      const tbody_buy = root.querySelector("#tbody-ob-buy");
      const tbody_sell = root.querySelector("#tbody-ob-sell");

      /* since the orders are retrieved from the DB's table in which are stored all the transactions (so for each order there could be multiple transactions, for example:
        1) transaction for order 123 with state SUBMITTED at timestamp i
        2) transaction for order 123 with state PARTIALLY FILLED at timestamp i+1
        since the order 123 has the last transaction with state PARTIALLY FILLED, it means that the (1) transaction cannot be shown because it has the state SUBMITTED 
        while the latest transaction (speaking about timestamp) for that order has the state PARTIALLY FILLED.
        ), i need to modify this "orders" array to show in the OrderBook only those transactions that are "valid" (so for orders on going).
        Simply speaking, if an order has multiple transactions (as the example above), it means that these will have the same type,userID,price but != timestamp and i need to take only the one with
        timestamp greater than the others.
        */
      const validOrders = [];
      orders.map((o, idx, arr) => {
        let i = 0;
        let add = true; // flag to check if this order needs to be discarded or not

        let transArr =
          o.status == "SUBMITTED"
            ? arr.filter((t) => t.refID == o.id && t.userID == o.userID)
            : arr.filter(
                (t) =>
                  t.refID == o.refID && t.userID == o.userID && t.id != o.id
              );

        if (transArr.length > 0) {
          // Other transactions found
          add = false;
        } else {
          if (o.status != "FILLED" && o.status != "CANCELLED") {
            // No other transactions found
            add = true;
          } else {
            add = false;
          }
        }

        if (add == true) {
          validOrders.push(o);
        }
      });

      // now all the orders are valid so filter the one with state FILLED or CANCELLED
      validOrders
        .filter((o) => o.status != "FILLED" && o.status != "CANCELLED") // process only orders that are SUBMITTED or PARTIALLY FILLED
        .map((o) => {
          let addLevel = true;
          levels.forEach((l, idx) => {
            if (l.type == o.type && l.price == o.price) {
              addLevel = false;
              // update this level without creating a new one because these are orders of the same "type" and "price"
              levels[idx].amount += o.amount;
            }
          });
          if (addLevel) {
            // create a new OB level
            levels.push({
              type: o.type,
              price: o.price,
              amount: o.amount,
            });
          }
        });

      // clear the tables
      if (tbody_buy != null && tbody_buy.childElementCount != 0) {
        while (tbody_buy.firstChild) {
          tbody_buy.removeChild(tbody_buy.firstChild);
        }
      }
      if (tbody_sell != null && tbody_sell.childElementCount != 0) {
        while (tbody_sell.firstChild) {
          tbody_sell.removeChild(tbody_sell.firstChild);
        }
      }

      // update the tables
      levels
        .sort((a, b) => (b.price ? b.price > a.price : a.price))
        .map((l) => {
          let tr = document.createElement("tr");
          tr.innerHTML = `<td>${l.price}</td><td>${l.amount}</td>`;
          // show only the latest N=4 levels
          if (
            l.type != "BUY" &&
            tbody_sell != null &&
            tbody_sell.childElementCount < 4
          ) {
            tbody_sell.appendChild(tr);
          } else if (tbody_buy != null && tbody_buy.childElementCount < 4) {
            tbody_buy.appendChild(tr);
          }
        });
    }

    /**
     * Function called by the observable when new values are emitted. It will update the dashboard preview showing the latest N=2 orders for this user
     * @param orders orders list
     */
    updateDashboardPreview(orders) {
      const userid = localStorage.getItem("id");
      const dash = new DashboardPreviewComponent(this.#client);
      dash.appendOrders(orders, userid);
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
  }

  /* Exporting component */
  win.OrderBookComponent ||= OrderBookComponent;
})(window);
