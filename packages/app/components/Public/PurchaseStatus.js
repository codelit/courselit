import { connect } from "react-redux";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import fetch from "isomorphic-unfetch";
import {
  TRANSACTION_FAILED,
  TRANSACTION_INITIATED,
  TRANSACTION_SUCCESS,
} from "../../config/constants";
import { addressProps, authProps } from "../../types";
import { Button, Grid, Typography } from "@material-ui/core";
import {
  TRANSACTION_STATUS_FAILED,
  TRANSACTION_STATUS_FAILED_DETAILS,
  TRANSACTION_STATUS_INITIATED,
  TRANSACTION_STATUS_SUCCESS,
  TRANSACTION_STATUS_SUCCESS_DETAILS,
  VERIFY_PAYMENT_BUTTON,
  VISIT_COURSE_BUTTON,
  PURCHASE_ID_HEADER,
} from "../../config/strings";
import Link from "next/link";
import { Section } from "@courselit/components-library";
import dynamic from "next/dynamic";

const AppLoader = dynamic(() => import("../AppLoader"));

const PurchaseStatus = (props) => {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { id, source } = router.query;
  const courseLink = source || "";

  useEffect(() => {
    if (props.auth.checked && props.auth.guest) {
      router.push("/");
    }
  }, [props.auth.checked]);

  useEffect(() => {
    if (props.auth && props.auth.token) {
      getPaymentStatus();
    }
  }, [props.auth.token]);

  const getPaymentStatus = async () => {
    let paymentStatus = await makePaymentStatusRequest({
      purchaseId: id,
      backend: props.address.backend,
      token: props.auth.token,
    });

    if (paymentStatus.status === 401) {
      router.push("/login");
      return;
    }

    if (paymentStatus.status === 404) {
      router.push("/");
      return;
    }

    try {
      paymentStatus = await paymentStatus.json();
      setStatus(paymentStatus.status);
    } catch (err) {}
  };

  const makePaymentStatusRequest = async ({ purchaseId, backend, token }) => {
    setLoading(true);

    const formData = new window.FormData();
    formData.append("purchaseid", purchaseId);

    const res = await fetch(`${backend}/payment/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    setLoading(false);

    return res;
  };

  return (
    <Section>
      <Grid container>
        {status === TRANSACTION_SUCCESS && (
          <Grid item container direction="column" spacing={4}>
            <Grid item>
              <Typography variant="h2">{TRANSACTION_STATUS_SUCCESS}</Typography>
            </Grid>
            <Grid item>
              <Typography variant="body1" color="textSecondary">
                {TRANSACTION_STATUS_SUCCESS_DETAILS}
              </Typography>
            </Grid>
            <Grid item>
              <Link href={courseLink}>
                <Button variant="outlined" color="primary">
                  {VISIT_COURSE_BUTTON}
                </Button>
              </Link>
            </Grid>
          </Grid>
        )}
        {status === TRANSACTION_INITIATED && (
          <>
            {loading ? (
              <>
                <AppLoader />
              </>
            ) : (
              <Grid item container direction="column" spacing={4}>
                <Grid item>
                  <Typography variant="h2">
                    {TRANSACTION_STATUS_INITIATED}
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="subtitle2">
                    {PURCHASE_ID_HEADER}: {id}
                  </Typography>
                </Grid>
                <Grid item>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={getPaymentStatus}
                  >
                    {VERIFY_PAYMENT_BUTTON}
                  </Button>
                </Grid>
              </Grid>
            )}
          </>
        )}
        {status === TRANSACTION_FAILED && (
          <Grid item container direction="column" spacing={4}>
            <Grid item>
              <Typography variant="h2">{TRANSACTION_STATUS_FAILED}</Typography>
            </Grid>
            <Grid item>
              <Typography variant="body1" color="textSecondary">
                {TRANSACTION_STATUS_FAILED_DETAILS}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="subtitle2">
                {PURCHASE_ID_HEADER}: {id}
              </Typography>
            </Grid>
            <Grid item>
              <Link href={courseLink}>
                <Button variant="outlined" color="primary">
                  {VISIT_COURSE_BUTTON}
                </Button>
              </Link>
            </Grid>
          </Grid>
        )}
      </Grid>
    </Section>
  );
};

PurchaseStatus.propTypes = {
  auth: authProps,
  address: addressProps,
};

const mapStateToProps = (state) => ({
  auth: state.auth,
  address: state.address,
});

export default connect(mapStateToProps)(PurchaseStatus);
