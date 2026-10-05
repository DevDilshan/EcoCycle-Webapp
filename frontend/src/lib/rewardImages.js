export const REWARD_IMAGES = [
  ['tote', 'Tote bag'], ['herb-seeds', 'Herb seeds'], ['mobile-reload', 'Mobile reload'],
  ['toothbrush', 'Bamboo toothbrushes'], ['water-bottle', 'Water bottle'],
  ['grocery-voucher', 'Grocery voucher'], ['compost-kit', 'Compost starter kit'],
  ['recycling-bins', 'Recycling bins'], ['utility-voucher', 'Utility voucher'],
  ['compost-bin', 'Garden composter'], ['tree', 'Tree planting'],
  ['solar-lights', 'Solar garden lights'], ['produce-bags', 'Produce bags'],
  ['cutlery', 'Bamboo cutlery'], ['notebook', 'Recycled notebook'],
].map(([key, label]) => ({ key, label, url: `/images/rewards/${key}.webp` }))

export function validRewardImage(value) {
  if (!value?.trim()) return true
  if (REWARD_IMAGES.some(image => image.url === value.trim())) return true
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}
