import { supabase } from './supabase'

const bucket = () => import.meta.env.VITE_SUPABASE_PICKUP_BUCKET || 'pickup-photos'

function extensionFromFile(file) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName !== file.name.toLowerCase()) {
    if (fromName === 'jpeg') return 'jpg'
    if (fromName.length <= 5) return fromName
  }
  const type = file.type?.split('/')[1]
  if (type === 'jpeg') return 'jpg'
  if (type) return type
  return 'jpg'
}

/** Uploads a waste photo to Supabase Storage; returns a public URL for the API. */
export async function uploadPickupPhoto(file) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not signed in')

  const ext = extensionFromFile(file)
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(bucket()).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) {
    let hint = ''
    if (error.message?.includes('row-level security')) {
      hint =
        ' Run supabase/pickup-photos-storage.sql in the Supabase SQL Editor (Storage RLS policies).'
    } else if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
      hint = ` Create a public "${bucket()}" bucket in Supabase Storage.`
    }
    throw new Error(`${error.message}${hint}`)
  }

  const { data } = supabase.storage.from(bucket()).getPublicUrl(path)
  return data.publicUrl
}
