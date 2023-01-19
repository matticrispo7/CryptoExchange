"use strict";

import fetch from "node-fetch";
import jwksRSA from "jwks-rsa";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const AUTHORIZATION_RE = /^Bearer (?<token>.+)/;
const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_OPENID_CONFIG =
  "https://accounts.google.com/.well-known/openid-configuration";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

/**
 * OpenID Connect middleware.
 */
export class OIDCMiddleware {
  /** @type {{clientId:string,secret:string,redirect:string}|null} */
  #cfg = null;
  #publicKeys = [];
  /** @type {Promise<true>|null} */
  #initializing = null;
  /** @type {OAuth2Client|null} */
  #auth = null;

  /**
   * Instances a new middleware.
   * @param {{clientId:string,secret:string,redirect:string}} cfg OpenID configuration
   */
  constructor(cfg) {
    this.#cfg = cfg;
    this.#auth = new OAuth2Client(cfg.clientId, cfg.secret, cfg.redirect);
  }

  /**
   * Initializes the OIDC middleware.
   * @return {Promise<boolean>} A promise that completes when the middleware is completely initialized.
   */
  async init() {
    if (this.#initializing) {
      return this.#initializing;
    }
    let resolve, reject;
    this.#initializing = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    try {
      const responseConfig = await fetch(GOOGLE_OPENID_CONFIG);
      if (!responseConfig.ok) {
        throw new Error("Failed to fetch the Google OpenID configuration");
      }
      /* dalla configurazione ottenuta ottengo il json webkeys uri */
      const { jwks_uri } = await responseConfig.json();
      const responseJWKS = await fetch(jwks_uri);
      if (!responseConfig.ok) {
        throw new Error("Failed to fetch the OpenID certificates");
      }
      const { keys } = await responseJWKS.json();
      const jwksClient = jwksRSA({ jwksUri: jwks_uri });

      for (const key of keys) {
        const signingKey = await jwksClient.getSigningKey(key.kid);
        this.#publicKeys.push(signingKey.getPublicKey());
      }
      resolve(true);
      console.debug("🔑 OpenID middleware successfully initialized");
    } catch (e) {
      console.error("Cannot initialize OpenID middleware", e);
      reject(e);
    }
    return this.#initializing;
  }

  verifyToken(token) {
    const opts = { audience: this.#cfg.clientId, issuer: GOOGLE_ISSUER };
    for (const pubKey of this.#publicKeys) {
      try {
        return jwt.verify(token, pubKey, opts);
      } catch (e) {
        console.warn("Failed to verify token with one public key");
      }
    }
    throw new Error("Cannot validate JWT token against any public key");
  }

  /**
   * Makes sure a request is authenticated.
   * @param {Request & {principal?:any}} req A request
   * @param {Response} res A response
   * @param next A callback to the next middleware
   * @return {Promise<void>} A promise that completes when the response is written
   */
  async validate(req, res, next) {
    await this.init();
    const authorization = req.header("Authorization"); //recupero l'header dalla richiesta (se presente)
    if (!authorization) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const found = authorization.match(AUTHORIZATION_RE);
    if (!found) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const {
      groups: { token },
    } = found;

    try {
      req.principal = this.verifyToken(token);
    } catch (err) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    next();
  }

  /**
   * Prepares the redirect to the login page.
   * @param {Request & {principal?:any}} req A request
   * @param {Response} res A response
   */
  login(req, res) {
    const { nonce, state } = req.query;
    if (!nonce || !state) {
      res.status(400).json({ error: "missing nonce or state" });
      return;
    }
    const authUrl = this.#auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      state: JSON.stringify([nonce, state]),
      scope: GOOGLE_SCOPE,
    });
    res.redirect(authUrl);
  }

  /**
   * Exchanges the authorization code for the access and refresh tokens.
   * @param {Request} req A request
   * @param {Response} res A response
   */
  async tokens(req, res) {
    const { code } = req.query;
    if (!code) {
      res.status(400).json({ error: "missing authorization token" });
      return;
    }
    const { tokens } = await this.#auth.getToken(code);
    console.info("🔒 User successfully logged in via Google", {
      scope: tokens.scope,
    });

    res.json({
      id_token: tokens.id_token,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  }
}
