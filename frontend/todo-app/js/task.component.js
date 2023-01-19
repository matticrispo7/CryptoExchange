"use strict";

(function (win) {
  /**
   * Encapsulates the control and view logics behind a single task.
   */
  class TaskComponent extends EventEmitter {
    /* #attr === convenction for PRIVATE attribute */
    /** @type {RestTaskModel} */
    #model;
    /** @type {HTMLElement|null} */
    #element;
    /** @type {Handler[]} */
    #handlers = [];
    /** @type {HTMLElement|null} */
    #edit = null;

    /**
     * Instances a new `TaskComponent` component.
     * @param model {RestTaskModel} A task model
     */
    constructor(model) {
      super();
      this.#model = model;
      this.#element = null;
      this.#handlers = [];
      this.#edit = null;
    }

    /**
     * Destroys this component, removing it from it's parent node.
     */
    destroy() {
      this.#handlers.forEach((h) => h.unregister());
      this.#element.remove();
    }

    /**
     * Initializes the component. (create the div and the elements inside)
     * @return {HTMLElement} The root element for this component.
     */
    init() {
      this.#element = document.createElement("div");
      this.#element.className = "task";
      this.#element.innerHTML = document.querySelector(
        "script#task-template"
      ).textContent;

      const inp = this.#element.querySelector("input");
      inp.id = `task-${this.#model.id}`;
      inp.name = inp.id;
      const lbl = this.#element.querySelector("label");
      lbl.htmlFor = inp.id;
      lbl.textContent = this.#model.description;

      const editBtn = this.#element.querySelector(
        ".task-right button[name=edit]"
      );
      let hdlr = new Handler("click", editBtn, () => this.edit());
      this.#handlers.push(hdlr);

      const compBtn = this.#element.querySelector(
        ".task-right button[name=complete]"
      );
      hdlr = new Handler("click", compBtn, () => this.complete());
      this.#handlers.push(hdlr);

      return this.#element;
    }

    edit() {
      if (this.#edit) {
        this.#edit.classList.remove("hidden");
      } else {
        this.#edit = document.createElement("div");
        this.#edit.className = "task-edit";
        this.#edit.innerHTML = document.querySelector(
          "script#task-edit-template"
        ).textContent;

        const btnSave = this.#edit.querySelector("button[name=save]");
        let hdlr = new Handler("click", btnSave, () => this.save());
        this.#handlers.push(hdlr);

        const btnCancel = this.#edit.querySelector("button[name=cancel]");
        hdlr = new Handler("click", btnCancel, () => this.cancel());
        this.#handlers.push(hdlr);
      }

      const inp = this.#edit.querySelector("input");
      inp.value = this.#model.description;

      const children = [
        this.#element.querySelector(".task-left"),
        this.#element.querySelector(".task-right"),
      ];

      children.forEach((c) => c.classList.add("hidden"));
      this.#element.append(this.#edit);
    }

    async save() {
      if (this.#edit) {
        const newDesc = (this.#edit.querySelector("input").value || "").trim();
        if (newDesc) {
          try {
            console.debug(
              `Attempting to update task ${this.#model.id} with '${newDesc}'...`
            );
            await this.#model.update(newDesc);
          } catch (e) {
            console.log(`Cannot update task ${this.#model.id}`);
          }
        }
        this._update();
        this._hideEditField();
      }
    }

    cancel() {
      this._hideEditField();
    }

    complete() {
      this.emit("completed", this.#model);
    }

    _hideEditField() {
      if (this.#edit) {
        this.#edit.classList.add("hidden");
      }

      const children = [
        this.#element.querySelector(".task-left"),
        this.#element.querySelector(".task-right"),
      ];
      children.forEach((c) => c.classList.remove("hidden"));
    }

    _update() {
      if (this.#element) {
        const lbl = this.#element.querySelector("label");
        lbl.textContent = this.#model.description;
      }
    }
  }

  /* Exporting component */
  win.TaskComponent ||= TaskComponent;
})(window);
