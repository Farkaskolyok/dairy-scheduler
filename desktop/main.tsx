import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RosterApp } from "../src/components/roster/RosterApp";
import "../src/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RosterApp />
  </StrictMode>,
);
