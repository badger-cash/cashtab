import styled from "styled-components";

export const CheckoutHeader = styled.div`
	display: flex;
	margin: 0 auto 0.1rem;
	flex-direction: column;
	h4 {
		font-size: 1rem;
		line-height: 1.5;
		text-align: center;

		color: #8a8a8a;
	}
	hr {
		display: inline-flex;
		height: 1px;
		width: 3rem;
		border: 0;
		background: rgba(0, 0, 0, 0.1);
	}

	h1 {
		font-size: 1.5rem;
		line-height: 1.5;
		font-weight: 800;
		text-align: center;

		color: #000000;
	}
`;

export const CheckoutStyles = styled.div`
	text-align: left;
	letter-spacing: -0.01em;
`;
export const PaymentDetails = styled.div`
	display: flex;
	margin: 0 auto;
	flex-direction: column;
	text-align: left;
	.title {
		font-weight: 600;
		font-size: 1rem;
		margin-bottom: 0.5rem;
		line-height: 1.25;

		color: #8a8a8a;
	}

	.offer-description {
		font-weight: 400;
		font-size: 1rem;
		line-height: 1.25;
		min-height: 2.5rem;
		margin: 0 0 0rem;

		color: #000000;
	}

	.merchant {
		display: block;
		font-weight: 400;
		font-size: 0.875rem;
		line-height: 1.25;

		color: #000000;
	}
`;
export const PurchaseAuthCode = styled.div`
	display: flex;
	margin: 0 auto;
	flex-direction: column;

	text-align: left;
	.text-muted {
		display: block;
		font-weight: 400;
		font-size: 0.875rem;
		line-height: 1.25;
		margin-bottom: 0;

		color: #8a8a8a;
	}
`;

export const Heading = styled.h3`
	font-weight: 600;
	font-size: 1.125rem;
	margin-bottom: 0.75rem;
	line-height: 1.25;

	color: #000;
`;
export const ListItem = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	margin: 0.1rem auto;
	flex-direction: row;
	justify-content: space-between;
	&.min-m {
		margin: 0.25rem auto;
	}
	.bold {
		font-weight: 800;
	}
	.gray {
		color: #8a8a8a;
	}
	.black {
		color: #000;
	}

	.key,
	.value {
		font-size: 1rem;
		line-height: 1.25;
	}

	.value {
		text-align: right;
	}
`;

export const CheckoutIcon = styled.img`
	width: 2rem;
	display: block;
	margin: 0 auto 0.5rem;
`;

export const HorizontalSpacer = styled.hr`
	display: block;
	height: 1px;
	width: 100%;
	border: 0;
	margin: 0.3rem 0;
	background: rgba(0, 0, 0, 0.1);
`;