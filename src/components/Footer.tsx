import React from 'react';
import logo from '../assets/logo.png';

export const Footer = () => {
    return (
        <footer className="bg-[#1e3a8a] text-white py-4 px-8 mt-auto">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="GPartner Logo" className="h-8 w-auto brightness-0 invert" />
                </div>
                <div className="text-xs text-gray-300">
                    Copyright © 2023 Gpartner. All Rights Reserved.
                </div>
            </div>
        </footer>
    );
};
