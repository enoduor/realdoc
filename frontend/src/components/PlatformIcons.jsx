import React from 'react';
import { 
  Linkedin, 
  Twitter, 
  Instagram, 
  Youtube, 
  Music 
} from 'lucide-react';

const PlatformIcons = () => {
  const platformIcons = [
    {
      name: 'linkedin',
      icon: <Linkedin size={32} color="#0A66C2" />,
      className: 'platform-icon linkedin'
    },
    {
      name: 'twitter',
      icon: <Twitter size={32} color="#000000" />,
      className: 'platform-icon twitter'
    },
    {
      name: 'instagram',
      icon: <Instagram size={32} color="#000000" />,
      className: 'platform-icon instagram'
    },
    {
      name: 'youtube',
      icon: <Youtube size={32} color="#FF0000" />,
      className: 'platform-icon youtube'
    },
    {
      name: 'tiktok',
      icon: <Music size={32} color="#000000" />,
      className: 'platform-icon tiktok'
    }
  ];

  return (
    <div className="platform-icons">
      {platformIcons.map((platform, index) => (
        <div key={index} className={platform.className}>
          {platform.icon}
        </div>
      ))}
    </div>
  );
};

export default PlatformIcons;
