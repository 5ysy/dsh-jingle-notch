/** Geometry is measured in Electron logical pixels, including the screen's menu band. */
export interface DisplayGeometry {
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
}
export interface NotchMeasurement { id: number; top: number; width: number }
export function islandGeometry(display: DisplayGeometry, measurement?: NotchMeasurement, fallbackWidth = 184) {
  const menu = Math.max(0, display.workArea.y - display.bounds.y)
  const top = measurement?.top ?? (menu >= 32 ? menu : 0)
  const notch = top > 0 ? Math.max(0, Math.min(measurement?.width ?? fallbackWidth, display.bounds.width - 110)) : 0
  return { notch, top: Math.max(28, Math.min(top, 100)), compactWidth: Math.max(110, notch + 110) }
}

/** NSScreen is the source of physical notch safe areas; no user data enters this program. */
export const screenProbe = String.raw`
import AppKit
let result: [[String: Any]] = NSScreen.screens.map { screen in
  let id = (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.intValue ?? 0
  var top: CGFloat = 0
  var width: CGFloat = 0
  if #available(macOS 12.0, *) {
    top = screen.safeAreaInsets.top
    if top > 0, let left = screen.auxiliaryTopLeftArea, let right = screen.auxiliaryTopRightArea {
      width = max(0, screen.frame.width - left.width - right.width)
    }
  }
  return ["id": id, "top": top, "width": width > 0 ? width : 184]
}
let data = try JSONSerialization.data(withJSONObject: result)
print(String(data: data, encoding: .utf8)!)
`
