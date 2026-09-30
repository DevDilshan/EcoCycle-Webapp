import { useCallback, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

/**
 * const [confirmDialog, confirm] = useConfirm()
 * if (!(await confirm({ title, message, confirmLabel, danger }))) return
 * ...and render {confirmDialog} once in the component.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null)

  const confirm = useCallback(
    (options) => new Promise((resolve) => setRequest({ options, resolve })),
    [],
  )

  function settle(result) {
    request?.resolve(result)
    setRequest(null)
  }

  const dialog = request && (
    <ConfirmDialog
      {...request.options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return [dialog, confirm]
}
