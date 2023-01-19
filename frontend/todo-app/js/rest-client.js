"use strict";

(function (win) {
  function mkUrl(baseUrl, path, queryParams) {
    const url = new URL(baseUrl, document.baseURI);
    if (path) {
      const sep = url.pathname.endsWith("/") || path.startsWith("/") ? "" : "/";
      url.pathname += sep + path;
    }
    if (queryParams && typeof queryParams === "object") {
      for (let key of Object.keys(queryParams)) {
        const v = queryParams[key];
        url.searchParams.append(key, v);
      }
    }

    return url;
  }

  function handleJsonResponse(req, resolve, reject) {
    if (req.readyState === XMLHttpRequest.DONE) {
      // Everything is good, the response was received.
      if (req.status === 200 || req.status === 201) {
        const hdr = req.getResponseHeader("Content-type");
        if (
          hdr.substr(0, 16) === "application/json" ||
          hdr.substr(0, 9) === "text/json"
        ) {
          resolve(JSON.parse(req.responseText));
        } else {
          const e = new Error("Not a JSON response");
          e.status = req.status;
          e.response = req.responseText;
          reject(e);
        }
      } else {
        const hdr = req.getResponseHeader("Content-type");
        const e = new Error("Operation failed");
        e.status = req.status;
        if (hdr === "application/json" || hdr === "text/json") {
          e.json = JSON.parse(req.responseText);
        } else {
          e.response = req.responseText;
        }
        reject(e);
      }
    }
  }

  function setHeaders(req, headers) {
    if (headers && typeof headers === "object") {
      for (let key of Object.keys(headers)) {
        req.setRequestHeader(key, headers[key]);
      }
    }
    // ===> set the authorization header for the given request
    const token = localStorage.getItem("jwt");
    if (token) {
      req.setRequestHeader("Authorization", `Bearer ${token}`);
    }
  }

  /**
   * A minimal AJAX client for RESTful APIs.
   */
  class RestClient {
    /**
     * Instances a new `RestClient`.
     * @param baseUrl {string?} Optional baseUrl
     */
    constructor(baseUrl) {
      this._baseUrl = baseUrl;
    }

    /**
     * Sends an AJAX request for the specified `method`.
     * @param method {'GET'|'POST'|'PUT'|'DELETE'} HTTP method
     * @param path {string} The URL path to be appended to this `baseUrl`
     * @param body {Object?} Optional body of the message, will be converted to JSON if present
     * @param queryParams {Object?} Optional query parameters
     * @param headers {Object?} Optional headers
     * @return {Promise} A promise of the JSON response.
     * @private
     */
    _send(method, path, body, queryParams, headers) {
      return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();

        // prepares the response handler
        req.onreadystatechange = () => handleJsonResponse(req, resolve, reject);
        req.open(method, mkUrl(this._baseUrl, path, queryParams));

        // populates additional headers
        setHeaders(req, headers);

        // send request
        if (body) {
          req.setRequestHeader("Content-Type", "application/json");
          req.send(JSON.stringify(body));
        } else {
          req.send();
        }
      });
    }

    /**
     * Sends a GET request.
     * @param path {string} URL path to be appended to base URL.
     * @param queryParams {Object?} Optional query parameters
     * @param headers {Object?} Optional headers
     * @return {Promise} A promise of the JSON response.
     */
    get(path, queryParams, headers) {
      return this._send("GET", path, null, queryParams, headers);
    }

    /**
     * Sends a POST request.
     * @param path {string} URL path to be appended to base URL.
     * @param body {Object?} Optional body of the message, will be converted to JSON if present
     * @param queryParams {Object?} Optional query parameters
     * @param headers {Object?} Optional headers
     * @return {Promise} A promise of the JSON response.
     */
    post(path, body, queryParams, headers) {
      return this._send("POST", path, body, queryParams, headers);
    }

    /**
     * Sends a PUT request.
     * @param path {string} URL path to be appended to base URL.
     * @param body {Object?} Optional body of the message, will be converted to JSON if present
     * @param queryParams {Object?} Optional query parameters
     * @param headers {Object?} Optional headers
     * @return {Promise} A promise of the JSON response.
     */
    put(path, body, queryParams, headers) {
      return this._send("PUT", path, body, queryParams, headers);
    }

    /**
     * Sends a DELETE request.
     * @param path {string} URL path to be appended to base URL.
     * @param queryParams {Object?} Optional query parameters
     * @param headers {Object?} Optional headers
     * @return {Promise} A promise of the JSON response.
     */
    del(path, queryParams, headers) {
      return this._send("DELETE", path, null, queryParams, headers);
    }
  }

  win.RestClient ||= RestClient;
})(window);
