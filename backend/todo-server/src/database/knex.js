import knex from "knex";

const connectedKnex = knex({
  client: "sqlite3",
  connection: {
    filename: "./src/database/soi.sqlite",
  },
  useNullAsDefault: true,
});

export { connectedKnex };
