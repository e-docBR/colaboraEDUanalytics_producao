export function formatGender(gender: string | null | undefined, short = false) {
  if (!gender) return null;

  const normalized = gender
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (normalized === 'M' || normalized === 'MASCULINO') {
    return short ? 'Masc.' : 'Masculino';
  }

  if (normalized === 'F' || normalized === 'FEMININO') {
    return short ? 'Fem.' : 'Feminino';
  }

  return gender;
}
