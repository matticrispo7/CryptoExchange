"use strict";
import ShortUniqueId from "short-unique-id";

/**
 * Representation of an order.
 */
class Order {
  constructor(id, amount, price, type, status, userID, ref) {
    this._id = id;
    this._amount = amount;
    this._price = price;
    this._type = type;
    this._status = status;
    this._userID = userID;
    this._timestamp = Math.floor(Date.now() / 1000);
    this._refID = ref;
  }
  get id() {
    return this._id;
  }
  set id(id) {
    this._id = id;
  }
  get amount() {
    return this._amount;
  }
  set amount(amount) {
    this._amount = amount;
  }

  get price() {
    return this._price;
  }
  set price(price) {
    this._price = price;
  }
  get type() {
    return this._type;
  }
  set type(type) {
    this._type = type;
  }
  get status() {
    return this._status;
  }
  set status(status) {
    this._status = status;
  }

  get userID() {
    return this._userID;
  }
  set userID(id) {
    this._userID = id;
  }

  get timestamp() {
    return this._timestamp;
  }
  set timestamp(ts) {
    this._timestamp = ts;
  }

  get refID() {
    return this._refID;
  }

  set refID(ref) {
    this._refID = ref;
  }
}

function toDTO(order) {
  return {
    id: order.id,
    amount: order.amount,
    price: order.price,
    type: order.type,
    status: order.status,
    timestamp: order.timestamp,
    userID: order.userID,
    refID: order.refID,
  };
}

/**
 * Initializes routes.
 * @param {Express} app Express application
 * @param {{iface: string, port: number, auth: boolean, oidc: {redirect: string, clientId: string, secret: string}}} config Configuration options
 * @param authMiddleware  authentication middleware
 * @param dbUser database connection against "users" schema
 * @param dbOrder database connection against "orders" schema
 * @param short_id to generate shortened id
 */
export function routes(app, config, authMiddleware, dbUser, dbOrder) {
  const authenticate = (req, res, next) =>
    authMiddleware.verifyToken(req, res, next);

  const uid = new ShortUniqueId();

  // endpoint for login
  app.post("/login", authMiddleware.userLogin, async (req, resp) => {
    // * save the refreshToken in the cookie so it's not exposed
    resp.cookie("refreshToken", req.refreshToken, {
      httpOnly: true,
      sameSite: "None",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
    resp.redirect(
      "/?token=" +
        req.token +
        "&refresh=" +
        req.refreshToken +
        "&id=" +
        req.userid
    );
  });

  // endpoint for signup
  app.post(
    "/signup",
    authMiddleware.verifySignUp,
    authMiddleware.encryptPassword,
    async (req, resp) => {
      let user = {
        // build the user obj
        id: req.userid,
        username: req.body.username,
        email: req.body.email,
        password: req.bcryptPassword,
        balance: 100000,
        btc_amount: 10,
      };

      // save user info to db
      await dbUser.createUser(user);

      resp.redirect(
        "/?token=" +
          req.token +
          "&refresh=" +
          req.refreshToken +
          "&id=" +
          req.userid
      );
    }
  );

  /* return the user information based on the userid passed */
  app.get("/users/:id", authenticate, async (req, resp) => {
    const user = await dbUser.getUserById(req.params.id);
    resp.json(user);
  });

  /* update the user info */
  app.put("/users/:id", authenticate, async (req, resp) => {
    const userid = req.params.id;
    const { balance, btc_amount } = req.body;
    const result = await dbUser.updateUser(userid, balance, btc_amount);
    resp.json(result);
  });

  /* Endpoint to generate a new access token from the refreshToken when the first expires */
  app.post("/tokens", (req, resp) => {
    authMiddleware.tokens(req, resp);
  });

  /* Endpoint to delete the refreshToken */
  app.delete("/tokens/:userid", async (req, resp) => {
    authMiddleware.deleteToken(req, resp);
  });

  /* Endpoint to get all the orders in DB*/
  app.get("/orders", authenticate, async (req, resp) => {
    //console.log("Retrieving from DB ALL orders");
    const orders = await dbOrder.getAllOrders();
    //console.log(`\n Orders: \n${orders.map((o) => JSON.stringify(o))}`);
    resp.json(orders);
  });

  /* Endpoint that provides the orders submitted by the user with id=req.params.id*/
  app.get("/users/:id/orders", authenticate, async (req, resp) => {
    //console.log(`Retrieving orders for user ${req.params.id}`);
    const orders = await dbOrder.getOrderByUserId(req.params.id);
    resp.json(orders);
  });

  /* Endpoint for submitting a new order.
  Once the order has been submitted, check if there are any other orders that can be hit by this (so their state can go either to PARTIALLY FILLED or FILLED)*/
  app.post("/order", authenticate, async (req, resp) => {
    let { amount, price, userid, type } = req.body; // get the order's values from the req.body
    // get the userInfo from DB (to check if the order can be submitted) and then update
    let userInfo;
    let { btc_amount, balance } = await dbUser.getUserById(userid);

    // check if the order submitted is valid
    if (type == "SELL" && amount > btc_amount) {
      resp.status(400);
      resp.json({ error: "Not enough BTC to sell" });
      return;
    } else if (type == "BUY" && price > balance) {
      resp.status(400);
      resp.json({ error: "Not enough balance to buy" });
      return;
    } else if (amount == 0 || price == 0) {
      resp.status(400);
      resp.json({ error: "Empty amount or price" });
      return;
    }

    // build the order obj to save in the DB
    let orderToSubmit = new Order(
      uid(),
      Number(amount),
      Number(price),
      type,
      "SUBMITTED",
      userid,
      null
    );

    let orderToSubmitFilled = false; // flag enabled if the order submitted has already been filled
    let remainingOrderAmount = orderToSubmit.amount; // delta BTC amount
    // check if the order that needs to be submitted changes AT LEAST one order to FILLED or PARTIALLY FILLED
    const orders = await dbOrder.getAllOrders();
    const updatedOrders = []; // list with the orders with the status updated based on the order submitted
    orders // get the orders with the SAME PRICE but OPPOSITE TYPE (those are the ones that can be matched by the orderToSubmit) and different userID that submitted the order
      .filter(
        (t) =>
          t.price == orderToSubmit.price &&
          t.type != orderToSubmit.type &&
          t.userID != orderToSubmit.userID
      )
      .map((order, idx, arr) => {
        /* Supponendo di fare il submit di un ordine "x" che vada a colpire un ordine "y", vado a recuperare la "storia" dell'ordine "y" (ovvero vado a verificare se l'ordine "y" ha delle transazioni che rappresentano gli update dello stesso ordine a partire dallo stato SUBMITTED).
      Nel caso ci siano transazioni allora quest'ordine "y" non va considerato nell'update degli ordini e si passa al successivo.
      Nel caso non ci siano transazioni allora questo ordine "y" può essere considerato per l'update degli ordini SOLO SE il suo stato è != FILLED o CANCELLED */
        // get the transactions for this order based on its state (SUBMITTED => get the transaction with refID = order.id, otherwise get the orders with same refID)
        let transArr =
          order.status == "SUBMITTED"
            ? arr.filter((t) => t.refID == order.id && t.userID == order.userID)
            : arr.filter(
                (t) =>
                  t.refID == order.refID &&
                  t.userID == order.userID &&
                  t.id != order.id
              );

        let tmp; // tmp object used for comparison in updating orders
        let orderValid = true; // flag used to skip this order if either its latest transaction if FILLED or CANCELLED or there are at least 1 transactions found for this order (in that case this order doesn't need to be considered)
        // if there are transactions for this order => check if the latest is not FILLED or CANCELLED
        if (transArr.length > 0) {
          // Other transactions found
          orderValid = false;
        } else {
          // there are not any other transactions => consider this order
          if (order.status != "FILLED" && order.status != "CANCELLED") {
            orderValid = true;
            tmp = order;
          } else {
            orderValid = false;
          }
        }
        // for each order, check if its state needs to be changed
        if (
          orderValid &&
          remainingOrderAmount < tmp.amount &&
          !orderToSubmitFilled
        ) {
          // the orderToSubmit has already been FILLED
          orderToSubmitFilled = true;
          // make a new order based on the one that makes orderToSubmit FILLED and set its state to PARTIALLY FILLED with same price and amount = initial_amount - orderToSubmit.amount
          let ordPartFilled = new Order(
            uid(),
            (tmp.amount - remainingOrderAmount) % 1 == 0
              ? tmp.amount - remainingOrderAmount
              : Number((tmp.amount - remainingOrderAmount).toFixed(1)),
            tmp.price,
            tmp.type,
            "PARTIALLY FILLED",
            tmp.userID,
            tmp.status == "SUBMITTED" ? tmp.id : tmp.refID
          );
          // save both the updated order (PARTIALLY FILLED) and the orderToSubmit (FILLED) to insert later in DB
          updatedOrders.push(toDTO(ordPartFilled));

          let orderFilled = new Order(
            uid(),
            remainingOrderAmount,
            orderToSubmit.price,
            orderToSubmit.type,
            "FILLED",
            orderToSubmit.userID,
            orderToSubmit.id
          );

          updatedOrders.push(toDTO(orderFilled));
        } else if (orderValid && !orderToSubmitFilled) {
          // OrderToSubmit has amount >= order hit found
          // orderToSubmit hits multiple orders
          let ordFilled = new Order(
            uid(),
            tmp.amount,
            tmp.price,
            tmp.type,
            "FILLED",
            tmp.userID,
            tmp.status == "SUBMITTED" ? tmp.id : tmp.refID
          );

          updatedOrders.push(toDTO(ordFilled)); // save the order found that was hit by the order submitted in DB
          remainingOrderAmount -= tmp.amount;

          // check if orderToSubmit is FILLED
          if (remainingOrderAmount == 0) {
            //console.log(`****** orderToSubmit ${orderToSubmit.id} => FILLED`);
            orderToSubmitFilled = true;

            let ordSubFilled = new Order(
              uid(),
              orderToSubmit.amount,
              orderToSubmit.price,
              orderToSubmit.type,
              "FILLED",
              orderToSubmit.userID,
              orderToSubmit.id
            );
            updatedOrders.push(toDTO(ordSubFilled));
          } else {
            // the order submitted can still hit some OTHER orders => save it in the DB (with state PARTIALLY FILLED) and keep searching other orders (if there are any)
            let tmp = new Order(
              uid(),
              remainingOrderAmount % 1 == 0
                ? remainingOrderAmount
                : Number(remainingOrderAmount.toFixed(1)),
              orderToSubmit.price,
              orderToSubmit.type,
              "PARTIALLY FILLED",
              orderToSubmit.userID,
              orderToSubmit.status == "SUBMITTED"
                ? orderToSubmit.id
                : orderToSubmit.refID
            );
            updatedOrders.push(toDTO(tmp));
          }
        } else {
          console.log(
            `Order [${order.id}] SKIPPED --> flagOrderToSubmitFilled: ${orderToSubmitFilled}`
          );
        }
      });

    // save in DB the order submitted
    let result = await dbOrder.createOrder(toDTO(orderToSubmit));
    if (updatedOrders.length > 0) {
      // and also the orders hit by the one submitted (if there are any)
      result = await dbOrder.createOrder(updatedOrders);
    }
    resp.json(result);
  });

  /* Endpoint to delete an order (only if its status is == SUBMITTED) */
  app.delete("/order/:id", authenticate, async (req, resp) => {
    let { id } = req.params;
    let order = await dbOrder.getOrderById(id);
    console.log(`DEL req for order ${id}`);

    let tmp = new Order(
      uid(),
      order.amount,
      order.price,
      order.type,
      "CANCELLED",
      order.userID,
      order.id
    );
    let result = await dbOrder.createOrder(toDTO(tmp));
    resp.json(result);
  });
}
