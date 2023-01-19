"use strict";

import util from "util";

// utilities
import { v4 as uuid } from "uuid";

// express
import express from "express";
import methodOverride from "method-override";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";

// own modules
import opts from "./options.js";
import { routes } from "./routes.js";
import { OIDCMiddleware } from "./openid.js";

// import middleware per auth
import * as Auth from "./middleware/auth.js";
// import middleware for db
import * as dbUser from "./database/users.js";
import * as dbOrder from "./database/orders.js";

/**
 * Initializes the application middlewares.
 *
 * @param {Express} app Express application
 */
function init(app) {
  /* compressione gzip delle chiamate/risposte http*/
  app.use(compression());
  app.use(methodOverride());
  /* parsing del json e cookie*/
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  // sets the correlation id of any incoming requests
  app.use((req, res, next) => {
    req.correlationId = req.get("X-Request-ID") || uuid();
    res.set("X-Request-ID", req.id);
    next();
  });
}

/**
 * Installs fallback error handlers.
 *
 * @param app Express application
 * @returns {void}
 */
function fallbacks(app) {
  // generic error handler => err.status || 500 + json
  // NOTE keep the `next` parameter even if unused, this is mandatory for Express 4
  /* eslint-disable-next-line no-unused-vars */
  app.use((err, req, res, next) => {
    const errmsg = err.message || util.inspect(err);
    console.error(
      `💥 Unexpected error occurred while calling ${req.path}: ${errmsg}`
    );
    res.status(err.status || 500);
    res.json({ error: err.message || "Internal server error" });
  });

  // if we are here, then there's no valid route => 400 + json
  // NOTE keep the `next` parameter even if unused, this is mandatory for Express 4
  /* eslint-disable no-unused-vars */
  app.use((req, res, next) => {
    console.error(`💥 Route not found to ${req.path}`);
    res.status(404);
    res.json({ error: "Not found" });
  });
}

async function run() {
  // creates the configuration options and the logger
  /* get options config */
  const options = opts();
  console.debug("🔧 Configuration", options);

  console.debug(`🔧 Initializing routes...`);
  /* create the express app */
  const app = express();
  init(app);
  /* define the app's endpoints */
  routes(app, options.config, Auth, dbUser, dbOrder); // permette di battezzare il routing dell'app
  fallbacks(app); // manage the errors

  const { iface, port } = options.config;
  app.listen(port, iface, () => {
    // noinspection HttpUrlsUsage
    console.info(`🏁 Server listening: http://${iface}:${port}`);
  });
}

// noinspection JSIgnoredPromiseFromCall
run();
