export const uid = () => {
  return crypto.randomUUID().slice(0, 8);
};
