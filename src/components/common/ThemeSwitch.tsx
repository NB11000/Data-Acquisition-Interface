import { useEffect, useState, useCallback } from 'react';
import { Switch } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';

const DARK_CLASS = 'dark-theme';
const STORAGE_KEY = 'app-theme';

export default function ThemeSwitch() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) !== 'light';
  });

  useEffect(() => {
    document.body.classList.toggle(DARK_CLASS, dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = useCallback(() => setDark((prev) => !prev), []);

  return (
    <Switch
      checked={dark}
      onChange={toggle}
      checkedChildren={<MoonOutlined />}
      unCheckedChildren={<SunOutlined />}
    />
  );
}
