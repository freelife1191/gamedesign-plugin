// codex spends one catalog allowance across every skill a user has installed, so each description's
// share shrinks as more skills arrive. Measured against this suite's 65-skill catalog, the cut landed
// between 120 and 123 characters — mid-word, with no ellipsis, and with no way for the model to know
// text was lost. Everything past the cut is trigger vocabulary the router never sees.
//
// This constant is the suite's own ceiling, set one character under the narrowest measurement so a
// description that fits here fits the real catalog too. It lives on its own because two unrelated
// callers bind to it: the routing measurement that checks every packaged description, and the vendor
// description overlay that exists solely to bring three vendored upstream descriptions under it.
export const CATALOG_DESCRIPTION_BUDGET = 119;
