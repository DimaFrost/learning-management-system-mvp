export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'at_risk': return 'text-red-600 bg-red-50 border-red-200';
    case 'lagging': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'on_track': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'at_risk': return 'bg-red-100 text-red-800';
    case 'lagging': return 'bg-yellow-100 text-yellow-800';
    case 'on_track': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'Teacher': return 'bg-blue-100 text-blue-800';
    case 'Translator': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};
