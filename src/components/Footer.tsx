import React from 'react';
import logo from '../assets/logo.png';

export const Footer = () => {
    return (
        <footer className="bg-[#1B263B] text-white py-3 px-8 mt-auto border-t border-slate-700/30">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="GPartner Logo" className="h-6 w-auto brightness-0 invert opacity-90" />
                </div>
                <div className="text-xs text-slate-400 font-light">
                    Copyright © 2023 Gpartner. All Rights Reserved.
                </div>
            </div>
        </footer>
    );
};
