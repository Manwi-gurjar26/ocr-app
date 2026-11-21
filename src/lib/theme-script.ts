export const THEME_KEY = "theme";

/**
 * Runs in <head> before first paint: resolves the saved preference (default "system")
 * and sets <html data-theme> so there is no flash of the wrong theme.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");if(p!=="light"&&p!=="dark")p="system";var t=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var d=document.documentElement;d.setAttribute("data-theme",t);d.setAttribute("data-theme-pref",p)}catch(e){}})()`;
