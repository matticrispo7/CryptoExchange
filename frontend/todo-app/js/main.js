"use strict";

(async function () {
  const client = new RestClient("/api");
  const root = document.querySelector(".content #root");
  /** @type {{init:()=>Promise<HTMLElement>,destroy:()=>void}[]} */
  const components = [];
  /** @type {{unsubscribe:() => void}|null} */
  let subscription = null;
  if (localStorage.getItem("jwt") != undefined) {
    localStorage.removeItem("jwt");
  }
  if (localStorage.getItem("id") != undefined) {
    localStorage.removeItem("id");
  }
  if (localStorage.getItem("refreshToken") != undefined) {
    localStorage.removeItem("refreshToken");
  }

  async function init() {
    //const token = localStorage.getItem("id_token");
    const token = localStorage.getItem("jwt");
    let elem,
      /** @type {{init:()=>Promise<HTMLElement>,destroy:()=>void}} */ comp;

    /* if the user logged in load HomeComponent, otherwise redirect the user to login */
    if (token) {
      // initializes the tasks
      comp = new HomeComponent(client);
      if (subscription) {
        subscription.unsubscribe();
      }
      subscription = null;
    } else {
      comp = new LoginComponent(client);
      subscription = comp.on("authenticated", init);
    }
    elem = await comp.init();
    components.forEach((c) => c.destroy());
    await root.appendChild(elem);
    components.push(comp);
  }

  // initializes the components
  await init();
  console.info("🏁 Application initialized");
})();
