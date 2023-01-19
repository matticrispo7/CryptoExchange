"use strict";

(function (win) {
  /**
   * Representation of a task.
   */
  class TaskModel {
    #id;
    #description;
    #timestamp;

    constructor(id, description) {
      this.#id = id;
      this.#description = description;
      this.#timestamp = new Date();
    }

    //@formatter:off
    get id() {
      return this.#id;
    }
    set id(id) {
      this.#id = id;
    }
    get description() {
      return this.#description;
    }
    set description(description) {
      this.#description = description;
    }
    get timestamp() {
      return this.#timestamp;
    }
    set timestamp(ts) {
      this.#timestamp = ts;
    }
    //@formatter:on
  }

  /**
   * A task that can be synchronized with the REST API.
   */
  class RestTaskModel extends TaskModel {
    /** @type {RestClient} */
    #client;

    /**
     * Instances a new `RestTaskModel`.
     * @param id {number?} Task identifier, can be null for newly created tasks.
     * @param description {string} A description
     * @param client {RestClient} A rest client
     */
    constructor(id, description, client) {
      super(id, description);
      this.#client = client;
    }

    toDto() {
      // return object representation of this task
      return {
        id: this.id,
        description: this.description,
        timestamp: this.timestamp,
      };
    }

    async create() {
      let dto = this.toDto(); // get the object representation of this task
      dto = await this.#client.post("task", dto); // send a post req with the obj of this task => response with the dto representation of this task
      this.id = dto.id;
      this.timestamp = Date.parse(dto.timestamp);
      return this; // return the task model
    }

    async delete() {
      await this.#client.del(`task/${encodeURIComponent(this.id)}`);
      return this;
    }

    async update(newDesc) {
      let dto = { description: newDesc };
      await this.#client.put(`task/${encodeURIComponent(this.id)}`, dto);
      this.description = newDesc;
      return this;
    }
  }

  /* Exporting models */
  win.RestTaskModel ||= RestTaskModel;
  win.TaskModel ||= TaskModel;
})(window);
