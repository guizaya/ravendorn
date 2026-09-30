import express from "express";
import { SERVER_CONFIG } from "./config.js";

const app = express();

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "rpg-2d-prototype-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/version", (_request, response) => {
  response.json({
    protocolVersion: SERVER_CONFIG.protocolVersion,
  });
});

app.get("/api/capabilities", (_request, response) => {
  response.json(SERVER_CONFIG.capabilities);
});

app.use((_request, response) => {
  response.status(404).json({
    error: "Route not found",
  });
});

app.listen(
  SERVER_CONFIG.port,
  SERVER_CONFIG.host,
  () => {
    console.log(
      `API disponível em http://localhost:${SERVER_CONFIG.port}`,
    );
  },
);
