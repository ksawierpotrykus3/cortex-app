// fix(audyt): 8-znakowe UUID (32 bity) powodowało kolizje przy większej liczbie encji
export const uid = () => {
  return crypto.randomUUID();
};
