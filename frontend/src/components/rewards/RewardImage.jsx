import { useState } from 'react'
import { Gift } from 'lucide-react'
import { validRewardImage } from '../../lib/rewardImages'
import '../../styles/reward-images.css'

export default function RewardImage({ src, className = '' }) {
  const [failed, setFailed] = useState(null)
  const show = src && validRewardImage(src) && failed !== src
  return (
    <span className={`reward-image ${className}`}>
      {show ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onError={() => setFailed(src)} /> : <Gift aria-hidden="true" size={26} strokeWidth={1.6} />}
    </span>
  )
}
