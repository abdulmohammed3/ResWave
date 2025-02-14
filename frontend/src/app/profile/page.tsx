'use client';

import { useState } from 'react';
import ProfileAvatar from '@/components/ProfileAvatar';

interface UserProfile {
  name: string;
  email: string;
  jobTitle: string;
  industry: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    jobTitle: '',
    industry: '',
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement profile update logic
    setIsEditing(false);
  };

  const inputClasses = "mt-1 block w-full rounded-lg border-[#A8D8EA] shadow-sm focus:border-[#4A90A0] focus:ring-[#4A90A0] bg-white/50 backdrop-blur-sm transition-all duration-200";
  const labelClasses = "block text-sm font-medium text-gray-700";
  const buttonClasses = {
    primary: "px-4 py-2 text-sm font-medium text-white bg-[#4A90A0] hover:bg-[#3A7A8A] rounded-lg transition-colors duration-200 shadow-sm hover:shadow",
    secondary: "px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-[#A8D8EA] transition-colors duration-200"
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">My Profile</h1>
      
      <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 border border-[#A8D8EA]/30">
        <ProfileAvatar />
        
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className={labelClasses}>
                Name
              </label>
              <input
                type="text"
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="email" className={labelClasses}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="jobTitle" className={labelClasses}>
                Job Title
              </label>
              <input
                type="text"
                id="jobTitle"
                value={profile.jobTitle}
                onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="industry" className={labelClasses}>
                Industry
              </label>
              <input
                type="text"
                id="industry"
                value={profile.industry}
                onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                className={inputClasses}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={buttonClasses.secondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={buttonClasses.primary}
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Profile Information</h3>
              <dl className="space-y-4 bg-white/50 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex justify-between items-center py-2 border-b border-[#A8D8EA]/30">
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="text-sm text-gray-900">{profile.name || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#A8D8EA]/30">
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{profile.email || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#A8D8EA]/30">
                  <dt className="text-sm font-medium text-gray-500">Job Title</dt>
                  <dd className="text-sm text-gray-900">{profile.jobTitle || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center py-2">
                  <dt className="text-sm font-medium text-gray-500">Industry</dt>
                  <dd className="text-sm text-gray-900">{profile.industry || 'Not set'}</dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className={buttonClasses.primary}
              >
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
