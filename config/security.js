const { rateLimit } = require("express-rate-limit");

// General limit (e.g. 100 requests per 15 minutes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});

// Stricter limit for login, admin actions, and video modification endpoints (5 requests per minute)
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many requests to this endpoint, please try again later.",
  },
});

module.exports = {
  generalLimiter,
  strictLimiter,
};