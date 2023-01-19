(function (win) {
  /**
   * Given an HTML element representing a task, extracts the task's ID.
   * @param el {HTMLElement} An HTML element representing a task
   * @return {number} The task's ID
   */
  function taskIdOf(el) {
    const idStr = el.id.substring(5 /*'task-'.length*/);
    return parseInt(idStr, 10);
  }

  /**
   * A component that shows, adds and removes tasks.
   */
  class TasksComponent {
    #element = null;
    #client = null;
    #tasks = [];

    /**
     * Instances this component.
     * @param client {RestClient} A REST client
     */
    constructor(client) {
      this.#client = client;
    }

    /**
     * Destroys this component, removing it from it's parent node.
     */
    destroy() {
      this.#element.remove();
    }

    /**
     * Initializes the component.
     * @return {Promise<HTMLElement>} The root element for this component.
     */
    async init() {
      this.#element = document.createElement("div");
      this.#element.className = "tasks";
      this.#element.innerHTML = document.querySelector(
        "script#tasks-template"
      ).textContent;

      const form = this.#element.querySelector('form[name="new-task"]'); 
      if (!form) {
        // form not built
        toast("Cannot initialize components: no <b>form</b> found", "error");
      }
      form.addEventListener("submit", ($event) => {
        $event.preventDefault(); /
        this.addTask(form);
        form.reset();
      });

      const a = this.#element.querySelector("a[data-action=complete-selected]");
      a.addEventListener("click", ($event) => {
        $event.preventDefault();
        this.removeSelectedTasks();
      });

      try {
        const resp = await this.#client.get("tasks"); 
        resp.results.forEach((dto) => {
          const model = new RestTaskModel(
            dto.id,
            dto.description,
            this.#client
          );
          this.createTaskComponent(model); // crea tutti i task recuperandoli dal modello
        });
      } catch (e) {
        console.error("Something went wrong getting tasks", e);
      }

      return this.#element;
    }

    async removeTask(task) {
      try {
        let i = this.#tasks.findIndex((t) => t.model.id === task.id);
        if (i >= 0) {
          console.log(`Deleting task ${task.id}...`);
          const { model } = this.#tasks[i];
          await model.delete();
          console.log(
            `Task ${model.id}, '${model.description}' successfully deleted!`
          );

          // this must be repeated as other things might have changed
          i = this.#tasks.findIndex((t) => t.model.id === task.id);
          const { component } = this.#tasks[i];
          component.destroy();
          this.#tasks.splice(i, 1);
        }
      } catch (e) {
        console.error(`Cannot delete task ${task.id}`, e);
      }
    }

    removeSelectedTasks() {
      const inps = this.#element.querySelectorAll(
        ".task-left input[type=checkbox]:checked"
      );
      const tasks = Array.prototype.slice
        .apply(inps)
        .map((el) => ({ id: taskIdOf(el) }));
      tasks.forEach(this.removeTask.bind(this));
    }

    createTaskComponent(model) {
      const root = this.#element.querySelector(".tasks");
      const component = new TaskComponent(model);
      this.#tasks.push({ model, component });
      const el = component.init();
      root.appendChild(el);
      component.on("completed", this.removeTask.bind(this));
    }

    async addTask(form) {
      const inp = form.querySelector("input");
      const desc = (inp.value || "").trim();
      if (desc) {
        console.log(`Saving new task '${desc}'...`);
        const model = new RestTaskModel(undefined, desc, this.#client); // create a new model with this parameters
        await model.create(); // wait that the task model has been successfully saved
        console.log("Task successfully saved", { model: model.toDto() });
        this.createTaskComponent(model);
      }
    }
  }

  /* Exporting component */
  win.TasksComponent ||= TasksComponent;
})(window);
