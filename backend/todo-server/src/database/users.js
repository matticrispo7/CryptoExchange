// File for CRUD operations against users table
import { connectedKnex as knex } from "./knex.js";

/* Each of the following functions return a promise (the one returned by knex)
because whenever a connect function to the db is called a promise is returned
so return the promise to who called the function*/
function createUser(user) {
  console.log(`adding ${JSON.stringify(user)} to db`);
  return knex("users").insert(user);
}

function getAllUsers() {
  return knex("users").select("*");
}

function getUserById(id) {
  // get the user with the given id
  return knex("users").where("id", id).first();
}

function getUserByUsername(username) {
  // get the user with the given id
  return knex("users").where("username", username).first();
}

function getUserByMail(email) {
  // get the user with the given id
  return knex("users").where("email", email).first();
}

// update the user balance and BTC amount
function updateUser(id, balance, amount) {
  return knex("users")
    .where("id", id)
    .update({ balance: balance, btc_amount: amount });
}

export {
  createUser,
  getAllUsers,
  getUserById,
  getUserByUsername,
  getUserByMail,
  updateUser,
};
