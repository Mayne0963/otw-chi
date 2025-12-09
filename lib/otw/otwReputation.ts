import {
  OtwFeedback,
  OtwDriverReputationSummary,
  OtwCustomerReputationSummary,
} from "./otwTypes";

const feedbackStore: OtwFeedback[] = [];

feedbackStore.push(
  {
    id: "FB-1",
    requestId: "REQ-1",
    driverId: "DRIVER-1",
    customerId: "CUSTOMER-1",
    rater: "CUSTOMER",
    rating: 5,
    comment: "On time, super professional.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "FB-2",
    requestId: "REQ-2",
    driverId: "DRIVER-1",
    customerId: "CUSTOMER-2",
    rater: "CUSTOMER",
    rating: 4,
    comment: "TV handled carefully, small delay but great communication.",
    createdAt: new Date().toISOString(),
  }
);

export const addFeedback = (feedback: OtwFeedback) => {
  feedbackStore.push(feedback);
  return feedback;
};

export const getFeedbackForDriver = (driverId: string): OtwFeedback[] => {
  return feedbackStore.filter((fb) => fb.driverId === driverId);
};

export const getFeedbackForCustomer = (customerId: string): OtwFeedback[] => {
  return feedbackStore.filter((fb) => fb.customerId === customerId);
};

export const getRecentFeedbackForDriver = (
  driverId: string,
  limit = 5
): OtwFeedback[] => {
  return getFeedbackForDriver(driverId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);
};

export const getDriverReputationSummary = (
  driverId: string
): OtwDriverReputationSummary => {
  const feedback = getFeedbackForDriver(driverId);
  if (feedback.length === 0) {
    return {
      driverId,
      avgRating: 0,
      totalRatings: 0,
      lastFeedback: undefined,
    };
  }

  const total = feedback.reduce((sum, fb) => sum + fb.rating, 0);
  const avgRating = Number((total / feedback.length).toFixed(2));
  const [lastFeedback] = feedback
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return {
    driverId,
    avgRating,
    totalRatings: feedback.length,
    lastFeedback,
  };
};

export const getCustomerReputationSummary = (
  customerId: string
): OtwCustomerReputationSummary => {
  const feedback = getFeedbackForCustomer(customerId);
  if (feedback.length === 0) {
    return {
      customerId,
      avgRatingGiven: 0,
      totalRatingsGiven: 0,
    };
  }

  const total = feedback.reduce((sum, fb) => sum + fb.rating, 0);
  const avgRatingGiven = Number((total / feedback.length).toFixed(2));

  return {
    customerId,
    avgRatingGiven,
    totalRatingsGiven: feedback.length,
  };
};

export const getAllFeedback = (): OtwFeedback[] => {
  return feedbackStore.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

