"use strict";

// IIFE
(function (win) {
  /**
   * Creates a new sequence function.
   * @return {function(): number} A function that returns sequences of numbers on each call
   */
  function sequencer() {
    let i = 1;
    return function () {
      const n = i;
      i++;
      return n;
    };
  }

  /**
   * An event handler that keeps track of the callback reference added
   * to an HTML element using `addEventListener` and removed with
   * `removeEventListener`.
   */
  class Handler {
    /**
     * Instances a new `Handler` and registers the `callback` function
     * for the specified `event` at the `element` level.
     * @param event {string} The event name
     * @param element {HTMLElement} An HTML element
     * @param callback {Function} The function to be invoked on `event`
     */
    constructor(event, element, callback) {
      this._event = event;
      this._element = element;
      this._callback = callback;
      this._element.addEventListener(this._event, this._callback);
    }

    //@formatter:off
    get event() {
      return this._event;
    }
    get element() {
      return this._element;
    }
    get callback() {
      return this._callback;
    }
    //@formatter:on

    /**
     * Unregisters this handler.
     */
    unregister() {
      this._element.removeEventListener(this._event, this._callback);
    }
  }

  /**
   * An entity that is able to emit events certain subscribers are
   * interested into.
   */
  class EventEmitter {
    constructor() {
      this._subscribers = [];
      this._seq = sequencer();
    }

    /**
     * Adds a new subscriber for the specified event.
     * @param event {string} An event name
     * @param callback {(data:any)=>void} A callback to be called when event is emitted
     * @return {{unsubscribe:()=>void}} An object to use to unsubscribe
     */
    on(event, callback) {
      const id = this._seq();
      this._subscribers.push({ id, event, callback });
      return {
        unsubscribe: this._unsubscribe.bind(this),
      };
    }

    _unsubscribe(anId) {
      const j = this._subscribers.findIndex((s) => s.id === anId);
      if (j >= 0) {
        this._subscribers.splice(j, 1);
      }
    }

    /**
     * Emits an event. This immediately triggers any callback that has
     * been subscribed for the exact same event.
     * @param event {string} The event name
     * @param data {Object?} Any additional data passed to the callback.
     */
    emit(event, data) {
      /*this._subscribers
        .filter((s) => s.event === event) // search for the events emitted
        .forEach((s) =>
          console.log(`[EVENT EMIT] calling callback: ${s.callback(data)}`)
        ); // apply the callback for the given event
        */

      this._subscribers
        .filter((s) => s.event === event) // search for the events emitted
        .forEach((s) => s.callback(data)); // apply the callback for the given event
    }
  }

  /**
   * Displays a toast when something happens.
   * @param msg {string} A message
   * @param type {string} The type
   */
  function toast(msg, type) {
    let t = document.body.querySelector(".toast");
    if (t) {
      t.remove();
    }
    t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    document.body.insertBefore(t, document.body.firstChild);
  }

  /* Exports components and functions */
  win.sequencer ||= sequencer;
  win.EventEmitter ||= EventEmitter;
  win.Handler ||= Handler;
  win.toast ||= toast;
})(window);
