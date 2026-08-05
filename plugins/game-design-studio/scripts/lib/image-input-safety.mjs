export function hasCredentialOrEncodedPayload(value) {
  return /(?:api[_ -]?key|authorization|bearer)/iu.test(value)
    || /\bdata:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+\b/iu.test(value)
    || /\bbase64\b/iu.test(value)
    || /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{8,}\b/iu.test(value)
    || /[A-Za-z0-9+/]{80,}={0,2}/u.test(value);
}
