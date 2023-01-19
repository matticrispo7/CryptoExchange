"use strict";
(function (win) {
  class UserInfoComponent {
    #client = null;
    #element = null;
    #handlers = [];

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
      this.#element.className = "row";
      this.#element.innerHTML = document.querySelector(
        "script#userinfo-template"
      ).textContent;

      let span_username = this.#element.querySelector("#span-username");
      let span_btc = this.#element.querySelector("#span-btc");
      let span_balance = this.#element.querySelector("#span-balance");
      const userid = localStorage.getItem("id");
      const token = localStorage.getItem("jwt");

      if (token) {
        try {
          // get user's info and set them for the spans text
          const user = await this.#client.get("users/" + userid);
          // set the data in the div for user information
          span_username.textContent = user.username;
          span_balance.textContent = user.balance.toFixed(2);
          span_btc.textContent = user.btc_amount;
        } catch (error) {
          if (error.status == 401) {
            // get new access token and send again the GET req
            let { accessToken } = await this.#client.post("/tokens");
            localStorage.setItem("jwt", accessToken);
            const { username } = await this.#client.get("users/" + userid);
            span_username.textContent = username;
          }
        }
      }
      return this.#element;
    }

    updateUserData(orders, userid) {
      const { from } = rxjs;
      const root = document.querySelector(".content #root");
      let span_btc = root.querySelector("#span-btc");
      let span_balance = root.querySelector("#span-balance");
      let initBTC = span_btc.textContent; // used to check if PUT req to update the user data needs to be sent or not
      let initBalance = span_balance.textContent;

      // get the orders for this user
      let baseBalance = 100000;
      let baseBTC = 10;
      orders
        .filter((t) => t.userID == userid)
        .filter((t) => t.status != "CANCELLED")
        .map((order, idx, arr) => {
          switch (order.status) {
            case "FILLED":
              // get the init order with state SUBMITTED
              const initOrder = arr.filter(
                (item) =>
                  item.type == order.type &&
                  item.userID == order.userID &&
                  item.price == order.price &&
                  item.id == order.refID
              )[0];
              baseBTC +=
                order.type == "BUY" ? initOrder.amount : -initOrder.amount;
              baseBalance +=
                order.type == "SELL" ? initOrder.price : -initOrder.price;

            case "PARTIALLY FILLED":
              // get the orders with the same refID as this one
              let ordHist = arr
                .filter(
                  (t) => t.refID == order.refID && t.userID == order.userID
                )
                .sort(
                  (a, b) =>
                    a.timestamp ? a.timestamp > b.timestamp : b.timestamp // sort in ASC order
                );
              // check if the latest transaction for this order is not in state FILLED
              if (ordHist.at(-1).status != "FILLED") {
                // get the initial order with state SUBMITTED to get initial BTC amount
                const initOrder = arr.filter(
                  (item) =>
                    item.type == order.type &&
                    item.userID == order.userID &&
                    item.price == order.price &&
                    item.id == order.refID
                )[0];
                // sum all the amount for the PARTIALLY FILLED orders (with initial value for the accumulator set to the amount for the order with state SUBMITTED)
                const diffBTC = ordHist.reduce(
                  (acc, val) => acc - val.amount,
                  initOrder.amount
                );
                baseBTC += order.type == "SELL" ? -diffBTC : diffBTC;
                baseBalance +=
                  order.type == "SELL"
                    ? (order.price * diffBTC) / initOrder.amount
                    : -((order.price * diffBTC) / initOrder.amount);
              }
          }
        });
      span_btc.textContent = baseBTC % 1 == 0 ? baseBTC : baseBTC.toFixed(2);
      span_balance.textContent = baseBalance.toFixed(2); // only 2 decimals

      // send PUT req only if the data has changed
      if (baseBTC != initBTC && baseBalance.toFixed(2) != initBalance) {
        // update data in DB
        from(
          this.#client.put(`/users/${userid}`, {
            balance: baseBalance.toFixed(2),
            btc_amount: baseBTC % 1 == 0 ? baseBTC : baseBTC.toFixed(2),
          })
        ).subscribe((result) => console.log(`PUT req. processed`));
      }
    }
  }

  /* Exporting component */
  win.UserInfoComponent ||= UserInfoComponent;
})(window);
