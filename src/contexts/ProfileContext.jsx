import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState({ username: 'User', total_exports: 0 });
  const [customFonts, setCustomFonts] = useState([]);
  const [customColors, setCustomColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      if (!window.electronAPI) return;
      const [prof, fonts, colors] = await Promise.all([
        window.electronAPI.getProfile(),
        window.electronAPI.getCustomFonts(),
        window.electronAPI.getCustomColors(),
      ]);
      if (prof) setProfile(prof);
      if (fonts) {
        setCustomFonts(fonts.map(f => {
          const pathVal = f.filePath || f.file_path;
          if (!pathVal) return f;
          return {
            ...f,
            file_path: `local-font://${pathVal.replace(/\\/g, '/')}`
          };
        }));
      }
      if (colors) {
        setCustomColors(colors.map(c => ({
          ...c,
          hex_code: c.hex_code?.length > 7 ? c.hex_code.substring(0, 7) : c.hex_code
        })));
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateUsername = async (username) => {
    if (!window.electronAPI) return;
    await window.electronAPI.updateProfile(username);
    setProfile(p => ({ ...p, username }));
  };

  const incrementExports = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.incrementExports();
    setProfile(p => ({ ...p, total_exports: p.total_exports + 1 }));
  };

  const uploadFont = async () => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.uploadCustomFont();
    if (res.success && res.font) {
      const pathVal = res.font.filePath || res.font.file_path;
      if (!pathVal) {
        setCustomFonts(prev => [res.font, ...prev]);
      } else {
        setCustomFonts(prev => [{
          ...res.font,
          file_path: `local-font://${pathVal.replace(/\\/g, '/')}`
        }, ...prev]);
      }
    }
    return res;
  };

  const removeFont = async (id) => {
    if (!window.electronAPI) return;
    await window.electronAPI.removeCustomFont(id);
    setCustomFonts(prev => prev.filter(f => f.id !== id));
  };

  const addColor = async (colorName, hexCode, brand) => {
    if (!window.electronAPI) return;
    const cleanHex = hexCode?.length > 7 ? hexCode.substring(0, 7) : hexCode;
    const res = await window.electronAPI.addCustomColor(colorName, cleanHex, brand);
    if (res.success && res.color) {
      setCustomColors(prev => [res.color, ...prev]);
    }
    return res;
  };

  const removeColor = async (id) => {
    if (!window.electronAPI) return;
    await window.electronAPI.removeCustomColor(id);
    setCustomColors(prev => prev.filter(c => c.id !== id));
  };

  return (
    <ProfileContext.Provider value={{
      profile,
      customFonts,
      customColors,
      loading,
      updateUsername,
      incrementExports,
      uploadFont,
      removeFont,
      addColor,
      removeColor
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  return useContext(ProfileContext);
};
