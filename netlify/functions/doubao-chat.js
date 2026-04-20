"use strict";

var DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
var REQUEST_TIMEOUT_MS = 60 * 1000;

function sanitizeText(input) {
  return String(input || "").trim();
}

function normalizeBaseUrl(input) {
  return sanitizeText(input || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function summarizeErrorText(input) {
  var text = sanitizeText(input);
  if (!text) {
    return "No details.";
  }
  if (text.length > 220) {
    return text.slice(0, 220) + "...";
  }
  return text;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Cache-Control": "no-store"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Method Not Allowed. Use POST."
    });
  }

  var requestBody;
  try {
    requestBody = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, {
      error: "Invalid JSON body."
    });
  }

  var apiKey = sanitizeText(requestBody.apiKey || process.env.DOUBAO_API_KEY);
  var model = sanitizeText(requestBody.model || process.env.DOUBAO_MODEL);
  var baseUrl = normalizeBaseUrl(requestBody.baseUrl || process.env.DOUBAO_BASE_URL);
  var messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
  var temperature = requestBody.temperature;

  if (!apiKey) {
    return jsonResponse(400, {
      error: "Missing apiKey."
    });
  }
  if (!model) {
    return jsonResponse(400, {
      error: "Missing model (endpoint id)."
    });
  }
  if (messages.length === 0) {
    return jsonResponse(400, {
      error: "Missing messages."
    });
  }

  var payload = {
    model: model,
    messages: messages
  };
  if (typeof temperature === "number" && Number.isFinite(temperature)) {
    payload.temperature = temperature;
  }

  var endpoint = normalizeBaseUrl(baseUrl) + "/chat/completions";
  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timeoutId = null;

  if (controller) {
    timeoutId = setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
  }

  var upstreamResponse;
  try {
    upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    });
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return jsonResponse(502, {
      error: "Upstream request failed.",
      detail: summarizeErrorText(error && error.message)
    });
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  var upstreamText = await upstreamResponse.text();
  return {
    statusCode: upstreamResponse.status,
    headers: {
      "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    },
    body: upstreamText
  };
};
