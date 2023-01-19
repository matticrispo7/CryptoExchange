// File for CRUD operations against orders table
import { connectedKnex as knex } from "./knex.js";

/* Each of the following functions return a promise (the one returned by knex)
because whenever a connect function to the db is called a promise is returned
so return the promise to who called the function*/
function createOrder(order) {
  //console.log(`adding order ${JSON.stringify(order)} to db`);
  return knex("orders").insert(order);
}

function getAllOrders() {
  return knex("orders").select("*");
}

function getOrderById(id) {
  // get the user with the given id
  return knex("orders").where("id", id).first();
}

function getOrderByUserId(id) {
  // get the user with the given id
  return knex("orders").where("userID", id);
}

function updateOrder(id, order) {
  return knex("orders").where("id", id).update(order);
}

function deleteOrder(id) {
  return knex("orders").where("id", id).del();
}

export {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrderByUserId,
  updateOrder,
  deleteOrder,
};
