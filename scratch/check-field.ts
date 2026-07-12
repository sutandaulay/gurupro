import { Field } from "payload";

// Let's print the properties of Field type if possible or check compile
const f: Field = {
  name: "id",
  type: "text",
  // Let's check what properties can be set here
};
console.log("Field imported successfully");
